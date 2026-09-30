const axios = require('axios');
const { randomUUID } = require('crypto');

const QUICK_LINK_ORIGIN = 'https://liveness.face.azure.com';

function config() {
  const endpoint = process.env.AZURE_FACE_ENDPOINT?.replace(/\/$/, '');
  const key = process.env.AZURE_FACE_KEY;
  if (!endpoint || !key) throw new Error('Azure Face liveness is not configured');
  return { endpoint, headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/json' } };
}

// Azure owns the camera experience. The Face API key never reaches the browser.
async function createQuickLink(callbackUrl) {
  const { endpoint, headers } = config();
  const { data: session } = await axios.post(
    `${endpoint}/face/v1.2/detectLiveness-sessions`,
    { livenessOperationMode: 'PassiveActive', deviceCorrelationId: randomUUID(), authTokenTimeToLiveInSeconds: 600, enableSessionImage: false },
    { headers },
  );
  const { data: quickLink } = await axios.post(
    `${QUICK_LINK_ORIGIN}/api/quicklink`, null,
    { headers: { Authorization: `Bearer ${session.authToken}` } },
  );
  if (!session.sessionId || !quickLink.url) throw new Error('Azure did not create a liveness link');
  const separator = quickLink.url.includes('?') ? '&' : '?';
  return { sessionId: session.sessionId, url: `${QUICK_LINK_ORIGIN}${quickLink.url}${separator}callbackUrl=${encodeURIComponent(callbackUrl)}` };
}

async function getLivenessResult(sessionId) {
  const { endpoint, headers } = config();
  const { data } = await axios.get(`${endpoint}/face/v1.2/detectLiveness-sessions/${encodeURIComponent(sessionId)}`, { headers });
  return data;
}

function passedLiveness(result) {
  const attempts = result?.results?.attempts || [];
  const completed = [...attempts].reverse().find((attempt) => attempt.attemptStatus === 'Succeeded');
  return String(completed?.result?.livenessDecision || '').toLowerCase() === 'realface';
}

module.exports = { createQuickLink, getLivenessResult, passedLiveness };
