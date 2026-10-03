const axios = require('axios');

const API_ORIGIN = 'https://verification.didit.me';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PENDING = new Set(['Not Started', 'In Progress', 'In Review', 'Resubmitted', 'Awaiting User']);

function verificationError(code, message, status = 503) {
  return Object.assign(new Error(message), { code, status, publicMessage: message });
}

// Compare full names exactly, allowing only case, whitespace, and equivalent
// Unicode encodings. Do not drop middle names, initials, accents or suffixes.
function normalizeName(value) {
  return typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase() : '';
}

function requireRegisteredName(fullName) {
  if (!normalizeName(fullName)) {
    throw verificationError('REGISTRATION_NAME_REQUIRED', 'Go back to Step 1 and enter your full name exactly as it appears on your ID.', 422);
  }
}

function verifiedIdName(id) {
  if (normalizeName(id.full_name)) return id.full_name.trim();
  // The provider's given name(s) and surname(s) are the documented fallback.
  if (normalizeName(id.first_name) && normalizeName(id.last_name)) {
    return `${id.first_name.trim()} ${id.last_name.trim()}`;
  }
  throw verificationError('ID_NAME_UNAVAILABLE', 'The full name could not be read from your ID. Start a new check with a clear ID, or contact the barangay office.', 422);
}

function config() {
  const apiKey = process.env.DIDIT_API_KEY?.trim();
  const workflowId = process.env.DIDIT_WORKFLOW_ID?.trim();
  if (!apiKey || !UUID.test(workflowId || '')) {
    throw verificationError('DIDIT_NOT_CONFIGURED', 'Identity verification is not configured. Please contact the barangay office.');
  }
  return { workflowId, headers: { 'x-api-key': apiKey }, timeout: 20000, maxRedirects: 0 };
}

function hostedUrl(value) {
  let url;
  try { url = new URL(value); } catch { /* invalid provider response */ }
  if (!url || url.protocol !== 'https:' || url.hostname !== 'verify.didit.me' || url.username || url.password || url.port) {
    throw verificationError('DIDIT_INVALID_RESPONSE', 'Could not open identity verification. Please try again.');
  }
  return url.href;
}

// Only authenticated Didit reports supply these URLs; never accept them from a browser.
function mediaUrl(value) {
  let url;
  try { url = new URL(value); } catch { /* missing/invalid media */ }
  const suffixes = ['.didit.me', '.amazonaws.com', '.cloudfront.net'];
  if (!url || url.protocol !== 'https:' || url.username || url.password || url.port ||
      !suffixes.some((suffix) => url.hostname.endsWith(suffix))) {
    throw verificationError('DIDIT_MEDIA_UNAVAILABLE', 'The verified images are not available yet. Please check the result again.', 502);
  }
  return url.href;
}

async function createSession(residentId, profileId, callback) {
  const options = config();
  const { data } = await axios.post(`${API_ORIGIN}/v3/session/`, {
    workflow_id: options.workflowId,
    vendor_data: residentId,
    metadata: { profile_id: profileId },
    callback,
    callback_method: 'initiator',
    language: 'en',
  }, options);
  if (!UUID.test(data?.session_id || '') || data.workflow_id !== options.workflowId || data.vendor_data !== residentId) {
    throw verificationError('DIDIT_INVALID_RESPONSE', 'Could not start identity verification. Please try again.');
  }
  return { sessionId: data.session_id, workflowId: options.workflowId, url: hostedUrl(data.url) };
}

async function getDecision(sessionId) {
  if (!UUID.test(sessionId || '')) throw verificationError('INVALID_VERIFICATION', 'Invalid verification session.', 403);
  const { data } = await axios.get(`${API_ORIGIN}/v3/session/${sessionId}/decision/`, config());
  return data;
}

function assessDecision(report, binding) {
  if (report?.session_id !== binding.sessionId || report.vendor_data !== binding.residentId ||
      report.workflow_id !== binding.workflowId || report.metadata?.profile_id !== binding.profileId) {
    throw verificationError('INVALID_VERIFICATION', 'This verification session does not belong to your current application.', 403);
  }
  // Mocked sandbox results cannot establish a resident's identity.
  if (report.environment !== 'live') {
    throw verificationError('DIDIT_SANDBOX_RESULT', 'This verification used a test environment. Please contact the barangay office.');
  }
  if (PENDING.has(report.status)) return { status: 'pending', providerStatus: report.status };
  if (report.status !== 'Approved') {
    throw verificationError('DIDIT_NOT_APPROVED', 'Identity verification was not completed or approved. Please start a new check, or contact the barangay office.', 422);
  }
  // A workflow-level approval alone is insufficient if any required check was skipped.
  for (const key of ['id_verifications', 'liveness_checks', 'face_matches']) {
    if (!Array.isArray(report[key]) || !report[key].length || report[key].some((check) => check.status !== 'Approved')) {
      throw verificationError('DIDIT_CHECKS_INCOMPLETE', 'The ID, live selfie, and face match must all pass before submission. Please contact the barangay office.', 422);
    }
  }
  requireRegisteredName(binding.fullName);
  const idNames = report.id_verifications.map(verifiedIdName);
  if (idNames.some((name) => normalizeName(name) !== normalizeName(binding.fullName))) {
    throw verificationError('ID_NAME_MISMATCH', 'The name on your ID does not match your registered full name. Go back to Step 1 and enter your full name exactly as it appears on your ID, including your middle name. You cannot submit until the names match.', 422);
  }
  const id = report.id_verifications[0];
  const liveness = report.liveness_checks[0];
  const faceMatch = report.face_matches[0];
  return {
    status: 'approved',
    idType: id.document_type || 'Government ID',
    idName: idNames[0],
    idFront: mediaUrl(id.front_image),
    idBack: id.back_image ? mediaUrl(id.back_image) : '',
    facePhoto: mediaUrl(liveness.reference_image),
    summary: {
      provider: 'didit', sessionId: report.session_id, workflowId: report.workflow_id,
      status: report.status, idStatus: id.status, livenessStatus: liveness.status,
      nameMatchStatus: 'Matched',
      livenessMethod: liveness.method || null, livenessScore: finiteScore(liveness.score),
      faceMatchStatus: faceMatch.status, faceMatchScore: finiteScore(faceMatch.score),
      checkedAt: new Date().toISOString(),
    },
  };
}

function finiteScore(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function respondError(res, err, stage) {
  // Provider bodies may contain personal data, signed media URLs, and tokens.
  console.error('Didit verification error:', { stage, status: err.response?.status, code: err.code || 'INTERNAL_ERROR' });
  if (err.publicMessage) return res.status(err.status).json({ code: err.code, message: err.publicMessage });
  if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(err.name)) {
    return res.status(403).json({ code: 'VERIFICATION_EXPIRED', message: 'Your verification session expired. Please start again.' });
  }
  const message = [401, 403].includes(err.response?.status)
    ? 'Identity verification could not be opened. Please contact the barangay office.'
    : 'Identity verification is temporarily unavailable. Please try again.';
  return res.status(503).json({ code: 'DIDIT_UNAVAILABLE', message });
}

module.exports = { createSession, getDecision, assessDecision, respondError, verificationError, mediaUrl, requireRegisteredName };
