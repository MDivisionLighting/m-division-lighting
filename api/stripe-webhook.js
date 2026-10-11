// api/stripe-webhook.js
// Listens for Stripe's checkout.session.completed event and increments the
// free-install counter — but only for orders that actually paid AND opted
// into local pickup + the free install. This is the only place the counter
// changes, so someone can't claim a "spot" by just checking a box and
// abandoning checkout.
import Stripe from 'stripe';
import { kv } from '@vercel/kv';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe needs the raw request body to verify the webhook signature, so
// body parsing must be turned off for this route.
export const config = { api: { bodyParser: false } };

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (chunk) => chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  let event;
  try {
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const meta = session.metadata || {};
    if (meta.local_pickup === 'yes' && meta.free_install_requested === 'yes') {
      try {
        await kv.incr('install_claimed');
      } catch (err) {
        console.error('Failed to increment install_claimed:', err);
      }
    }
  }

  return res.status(200).json({ received: true });
}
