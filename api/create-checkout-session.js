// api/create-checkout-session.js
// Deploy this on Vercel (or adapt slightly for Netlify/Render/AWS Lambda).
// It receives the cart from the front end, computes the real total on the
// server (never trust client-sent prices), and creates a Stripe Checkout
// Session. Stripe Checkout shows Card, Apple Pay and Google Pay to the
// customer automatically. PayPal isn't included — it's not available
// through Stripe for Canadian accounts.

import Stripe from 'stripe';
import { kv } from '@vercel/kv';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Launch pricing window — mirrors the deadline in m-division-lighting.html.
// Keep these two in sync (same timestamp) so the price shown on the page
// always matches what actually gets charged.
const LAUNCH_END = new Date("2026-09-28T23:59:59-07:00").getTime(); // 11:59 PM Pacific
const launchActive = () => Date.now() < LAUNCH_END;

// Prices in cents — source of truth lives on the server, not the browser.
const PRICES_CENTS = launchActive()
  ? { '2pc': 2999, '4pc': 4999 }   // launch pricing
  : { '2pc': 3999, '4pc': 5999 };  // regular pricing
const PRODUCT_LABELS = {
  '2pc': '2-Piece Puddle Light Kit',
  '4pc': '4-Piece Puddle Light Kit',
};

const NA_COUNTRIES = ['US', 'CA', 'MX'];
const INTL_SHIPPING_CENTS = { GB: 1200, DE: 1400, FR: 1400, AU: 1800, DEFAULT: 2000 };

export default async function handler(req, res) {
  // CORS: allow your storefront domain to call this endpoint.
  res.setHeader('Access-Control-Allow-Origin', '*'); // tighten to your domain before going live
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { cart, country, shipData } = req.body;
    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const line_items = cart.map((item) => {
      const unit_amount = PRICES_CENTS[item.key];
      if (!unit_amount) throw new Error(`Unknown product key: ${item.key}`);
      const qty = Math.max(1, parseInt(item.qty, 10) || 1);
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${PRODUCT_LABELS[item.key]} — ${item.badge || 'Standard'}`,
          },
          unit_amount,
        },
        quantity: qty,
      };
    });

    const isPickup = !!(shipData && shipData.pickup);
    const isNA = NA_COUNTRIES.includes(country);
    const shippingCents = isPickup ? 0 : isNA ? 0 : (INTL_SHIPPING_CENTS[country] ?? INTL_SHIPPING_CENTS.DEFAULT);
    const shippingLabel = isPickup
      ? 'Local pickup (Vancouver, BC)'
      : isNA
      ? 'Free shipping (North America)'
      : 'International shipping';

    // Re-check spots remaining server-side right before creating the
    // session — the front end already hides the checkbox at 0 remaining,
    // but this is the real gate, since two people could check out at once.
    let installGranted = false;
    if (isPickup && shipData && shipData.freeInstallOptIn) {
      try {
        const claimed = (await kv.get('install_claimed')) || 0;
        installGranted = claimed < 10;
      } catch (e) {
        installGranted = true; // KV not set up yet — fail open rather than block checkout
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      payment_method_types: ['card'],
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: shippingCents, currency: 'usd' },
            display_name: shippingLabel,
          },
        },
      ],
      // Shows up in Stripe Dashboard → this order, so you can manually track
      // and confirm the "first 10" free-install claims.
      metadata: {
        local_pickup: isPickup ? 'yes' : 'no',
        free_install_requested: installGranted ? 'yes' : 'no',
      },
      success_url: `${req.headers.origin}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/?canceled=true`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe session error:', err);
    return res.status(500).json({ error: err.message });
  }
}
