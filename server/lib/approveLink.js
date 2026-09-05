const crypto = require('crypto');

/**
 * Signed, expiring links that let a Purok Leader approve from the SMS without
 * logging in. The link carries the leader's id, an expiry, and an HMAC over the
 * two. No database row is needed — the signature is the proof — and it can only
 * ever authorise approvals for that one leader's own purok.
 *
 * APPROVE_LINK_SECRET must be set (and identical on every backend that builds a
 * link). Without it the feature refuses to sign, so a link is never emitted
 * that the server cannot later verify.
 */

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // a week — long enough for a slow reply

function secret() {
  const s = process.env.APPROVE_LINK_SECRET;
  if (!s) throw new Error('APPROVE_LINK_SECRET is not configured');
  return s;
}

function sign(leaderId, exp) {
  return crypto.createHmac('sha256', secret()).update(`${leaderId}.${exp}`).digest('hex');
}

// Returns the query string (lid, exp, sig) for an approval link, or null if the
// secret is missing — callers treat null as "no link, fall back to plain text".
function tokenParams(leaderId) {
  try {
    const exp = Date.now() + TTL_MS;
    const sig = sign(leaderId, exp);
    return { lid: leaderId, exp, sig };
  } catch {
    return null;
  }
}

// Full tap-to-approve URL, or null if it cannot be signed.
function buildLink(portalBase, leaderId) {
  const t = tokenParams(leaderId);
  if (!t) return null;
  const base = String(portalBase || '').replace(/\/+$/, '');
  return `${base}/purok-approve?lid=${encodeURIComponent(t.lid)}&exp=${t.exp}&sig=${t.sig}`;
}

// Verifies a link's params. Returns the leaderId when valid, else null.
function verify({ lid, exp, sig }) {
  if (!lid || !exp || !sig) return null;
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Date.now()) return null; // expired
  let expected;
  try { expected = sign(lid, expNum); } catch { return null; }
  const a = Buffer.from(String(sig));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return lid;
}

module.exports = { buildLink, tokenParams, verify, TTL_MS };
