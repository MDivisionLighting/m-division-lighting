// api/install-spots.js
// Returns how many of the 10 launch free-install spots are left.
// The count only goes up via the Stripe webhook below, when an order that
// actually paid has claimed one — never from the front end directly, so
// nobody can inflate or fake the number from a browser console.
import { kv } from '@vercel/kv';

const TOTAL_SPOTS = 10;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.mdivisionlighting.com');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const claimed = (await kv.get('install_claimed')) || 0;
    const remaining = Math.max(0, TOTAL_SPOTS - claimed);
    return res.status(200).json({ claimed, remaining, total: TOTAL_SPOTS });
  } catch (err) {
    // If KV isn't set up yet, fail open with "all spots available" rather
    // than breaking the page.
    return res.status(200).json({ claimed: 0, remaining: TOTAL_SPOTS, total: TOTAL_SPOTS });
  }
}
