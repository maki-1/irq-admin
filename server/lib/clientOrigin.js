/**
 * Where to send a resident's browser after an external redirect (PayMongo
 * checkout).
 *
 * CLIENT_URL is the CORS allowlist (see src/app.js) and its order is arbitrary:
 * its first entry has been an API host, so paid residents were redirected to a
 * different service's static page instead of back into their account, and the
 * request was never verified as paid.
 *
 * The return base is therefore taken from the browser that actually started the
 * checkout — its Origin, or the origin of its Referer — accepted only when that
 * value is in the allowlist, so a forged header cannot bounce a resident
 * off-site. RESIDENT_PORTAL_URL and then the first allowlisted origin are the
 * fallbacks for callers that send neither header.
 */

const stripSlash = (s) => String(s || '').trim().replace(/\/+$/, '');

function allowedOrigins() {
  return (process.env.CLIENT_URL || '')
    .split(',')
    .map(stripSlash)
    .filter(Boolean);
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * @param {import('express').Request} req  the request that started the checkout
 * @param {string} [fallback]              last resort when nothing is configured
 * @returns {string} an origin with no trailing slash, e.g. 'https://irq-client.vercel.app'
 */
function clientOriginFor(req, fallback = 'http://localhost:5174') {
  const allowed = allowedOrigins();

  const fromBrowser = [req?.get?.('origin'), originOf(req?.get?.('referer'))]
    .map(stripSlash)
    .filter(Boolean)
    .find((o) => allowed.includes(o));
  if (fromBrowser) return fromBrowser;

  const configured = stripSlash(process.env.RESIDENT_PORTAL_URL);
  if (configured) return configured;

  return allowed[0] || stripSlash(fallback);
}

module.exports = { clientOriginFor, allowedOrigins };
