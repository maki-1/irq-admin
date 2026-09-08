/**
 * Gate for the walk-in kiosk endpoints.
 *
 * The kiosk has no login: the printed purok-clearance control number a resident
 * types is the only secret they present. That makes the endpoints an attractive
 * control-number oracle for anyone who can reach them, so this guard adds two
 * dependency-free defences:
 *
 *   1. A shared device key (`X-Kiosk-Key`) that every kiosk terminal sends and
 *      the wider internet does not have.
 *   2. A small in-memory per-IP rate limit, to blunt brute-force guessing.
 *
 * If the kiosk fleet ever outgrows a handful of terminals behind one egress IP,
 * swap the limiter for a shared store (Redis, etc.).
 */

const WINDOW_MS = 60_000;
const MAX_HITS = 10;
const hits = new Map(); // ip -> number[] of recent request timestamps

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_HITS;
}

// Keep the Map from growing without bound on a long-lived process.
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [ip, times] of hits) {
    const recent = times.filter((t) => t > cutoff);
    if (recent.length) hits.set(ip, recent);
    else hits.delete(ip);
  }
}, WINDOW_MS).unref();

module.exports = function kioskGuard(req, res, next) {
  const configured = process.env.KIOSK_KEY;
  if (configured) {
    if (req.get('X-Kiosk-Key') !== configured) {
      return res.status(401).json({ message: 'Kiosk not authorized' });
    }
  } else if (process.env.NODE_ENV === 'production') {
    // Never serve these endpoints wide open in production.
    return res.status(503).json({ message: 'Kiosk key not configured' });
  }

  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  if (rateLimited(ip)) {
    return res.status(429).json({ message: 'Too many attempts. Please wait a moment and try again.' });
  }
  next();
};
