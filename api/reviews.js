// api/reviews.js
// GET  -> returns approved reviews only (what the public site displays)
// POST -> a customer submits a new review; it's stored as "pending" until
//         you approve it, so a stranger can't post spam straight to your
//         live site. Approve/reject with a simple admin action below.
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.mdivisionlighting.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ---- Submit a new review (goes to a pending queue) ----
  if (req.method === 'POST') {
    try {
      const { name, badge, rating, text, orderEmail, admin } = req.body;

      // Admin action: approve or reject a pending review.
      // Call this yourself (e.g. from a simple fetch, or Postman) — never
      // exposed as a button on the public site.
      if (admin) {
        if (admin.secret !== process.env.REVIEWS_ADMIN_SECRET) {
          return res.status(401).json({ error: 'Not authorized' });
        }
        const pending = (await kv.get('reviews_pending')) || [];
        const idx = pending.findIndex((r) => r.id === admin.id);
        if (idx === -1) return res.status(404).json({ error: 'Review not found' });
        const [review] = pending.splice(idx, 1);
        await kv.set('reviews_pending', pending);
        if (admin.action === 'approve') {
          const approved = (await kv.get('reviews_approved')) || [];
          approved.unshift(review);
          await kv.set('reviews_approved', approved);
        }
        return res.status(200).json({ ok: true });
      }

      // Basic validation
      if (!name || !text || !rating) {
        return res.status(400).json({ error: 'Missing name, rating, or review text' });
      }
      const cleanRating = Math.max(1, Math.min(5, parseInt(rating, 10) || 5));
      if (text.length > 1000) {
        return res.status(400).json({ error: 'Review is too long' });
      }

      const review = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        name: String(name).slice(0, 60),
        badge: badge ? String(badge).slice(0, 40) : '',
        rating: cleanRating,
        text: String(text).slice(0, 1000),
        orderEmail: orderEmail ? String(orderEmail).slice(0, 200) : '',
        submittedAt: new Date().toISOString(),
      };

      const pending = (await kv.get('reviews_pending')) || [];
      pending.push(review);
      await kv.set('reviews_pending', pending);

      return res.status(200).json({ ok: true, message: 'Thanks! Your review will appear once we approve it.' });
    } catch (err) {
      console.error('Review submit error:', err);
      return res.status(500).json({ error: 'Could not submit review right now' });
    }
  }

  // ---- Fetch approved reviews for the public site ----
  if (req.method === 'GET') {
    try {
      const approved = (await kv.get('reviews_approved')) || [];
      return res.status(200).json({ reviews: approved });
    } catch (err) {
      return res.status(200).json({ reviews: [] });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
