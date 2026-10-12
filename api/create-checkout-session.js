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
const LAUNCH_START = new Date("2026-10-12T12:00:00-07:00").getTime(); // Monday 12:00pm Pacific
const LAUNCH_END = new Date("2026-10-19T12:00:00-07:00").getTime();   // 7 days later
const launchActive = () => { const now = Date.now(); return now >= LAUNCH_START && now < LAUNCH_END; };

// Prices in cents — source of truth lives on the server, not the browser.
// Computed per request (not once at startup), so a warm server instance
// switches to/from launch pricing exactly at the deadline.
const currentPricesCents = () => launchActive()
  ? { '2pc': 2999, '4pc': 4999 }   // launch pricing
  : { '2pc': 3999, '4pc': 5999 };  // regular pricing
const PRODUCT_LABELS = {
  '2pc': '2-Piece Puddle Light Kit',
  '4pc': '4-Piece Puddle Light Kit',
};

// We only ship to Canada and the US (free). Stripe's address form is
// limited to these two, so no other destination can get through checkout.
const SHIP_COUNTRIES = ['CA', 'US'];
const SITE_ORIGIN = 'https://www.mdivisionlighting.com';
const MAX_QTY_PER_LINE = 10;

export default async function handler(req, res) {
  // CORS: only your own storefront domain may call this endpoint.
  res.setHeader('Access-Control-Allow-Origin', 'https://www.mdivisionlighting.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { cart, country, shipData } = req.body;
    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const PRICES_CENTS = currentPricesCents();
    const line_items = cart.map((item) => {
      const unit_amount = PRICES_CENTS[item.key];
      if (!unit_amount) throw new Error(`Unknown product key: ${item.key}`);
      const qty = Math.min(MAX_QTY_PER_LINE, Math.max(1, parseInt(item.qty, 10) || 1));
      const badge = String(item.badge || 'Standard').slice(0, 60);
      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${PRODUCT_LABELS[item.key]} — ${badge}`,
          },
          unit_amount,
        },
        quantity: qty,
      };
    });

    const isPickup = !!(shipData && shipData.pickup);
    if (!isPickup && country && !SHIP_COUNTRIES.includes(country)) {
      return res.status(400).json({ error: 'We currently ship to Canada and the US only.' });
    }
    const shippingCents = 0;
    const shippingLabel = isPickup
      ? 'Local pickup (Vancouver, BC)'
      : 'Free shipping (Canada & US)';

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
      // Prefill the email the customer already typed, so Stripe's own page
      // doesn't ask them to type it again.
      customer_email: (shipData && shipData.email) ? String(shipData.email).slice(0, 200) : undefined,
      // For shipped orders, Stripe itself collects the real shipping
      // address on its hosted page (the only address we actually trust —
      // the site's own address fields are just for the shipping estimate).
      // Local pickup orders skip this since there's nothing to ship.
      ...(isPickup ? {} : {
        shipping_address_collection: { allowed_countries: SHIP_COUNTRIES },
      }),
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
      // and confirm the "first 10" free-install claims, and cross-check the
      // customer's name/phone against the address Stripe collected.
      metadata: {
        local_pickup: isPickup ? 'yes' : 'no',
        free_install_requested: installGranted ? 'yes' : 'no',
        customer_name: shipData && shipData.name ? String(shipData.name).slice(0, 100) : '',
        customer_phone: shipData && shipData.phone ? String(shipData.phone).slice(0, 40) : '',
      },
      success_url: `${SITE_ORIGIN}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_ORIGIN}/?canceled=true`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe session error:', err);
    return res.status(500).json({ error: err.message });
  }
}
