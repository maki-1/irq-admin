const jwt = require('jsonwebtoken');
const prisma = require('../../lib/prisma');
const cloudinary = require('../config/cloudinary');
const didit = require('../utils/diditVerification');

const tokenOptions = { algorithm: 'HS256', issuer: 'irq-server', audience: 'irq-didit' };
const reviewStatuses = new Set(['pending', 'under review', 'approved']);
const signingSecret = () => process.env.LIVENESS_SESSION_SECRET || process.env.JWT_SECRET;

function sign(payload, expiresIn) {
  if (!signingSecret()) throw didit.verificationError('VERIFICATION_NOT_CONFIGURED', 'Identity verification is not configured. Please contact the barangay office.');
  return jwt.sign(payload, signingSecret(), { ...tokenOptions, expiresIn });
}

function readToken(token, purpose, resident) {
  const payload = jwt.verify(token, signingSecret(), {
    algorithms: ['HS256'], issuer: tokenOptions.issuer, audience: tokenOptions.audience,
  });
  if (payload.purpose !== purpose || payload.sub !== resident.id ||
      payload.sessionVersion !== (resident.sessionVersion || 0) || !payload.profileId || !payload.sessionId ||
      payload.workflowId !== process.env.DIDIT_WORKFLOW_ID?.trim()) {
    throw didit.verificationError('INVALID_VERIFICATION', 'Invalid verification session. Please start again.', 403);
  }
  return payload;
}

async function currentProfile(resident, profileId) {
  const profile = await prisma.verificationProfile.findUnique({ where: { userId: resident.id } });
  if (!profile || (profileId && profile.id !== profileId)) {
    throw didit.verificationError('APPLICATION_CHANGED', 'Your application has changed. Complete the earlier steps and start verification again.', 409);
  }
  if (resident.isVerified || reviewStatuses.has(String(profile.status).toLowerCase())) {
    throw didit.verificationError('ALREADY_SUBMITTED', 'Your application has already been submitted for review.', 409);
  }
  if (resident.verificationStep !== 2) {
    throw didit.verificationError('EARLIER_STEPS_REQUIRED', 'Complete steps 1 and 2 before verifying your identity.', 409);
  }
  return profile;
}

function callbackOrigin(req) {
  const origin = req.get('origin');
  const allowed = (process.env.CLIENT_URL || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) {
    throw didit.verificationError('PORTAL_NOT_ALLOWED', 'This portal is not configured for identity verification.', 403);
  }
  return origin;
}

async function verifiedResult(payload, resident) {
  return didit.assessDecision(await didit.getDecision(payload.sessionId), {
    sessionId: payload.sessionId, workflowId: payload.workflowId,
    residentId: resident.id, profileId: payload.profileId,
  });
}

exports.start = async (req, res) => {
  try {
    const origin = callbackOrigin(req);
    const profile = await currentProfile(req.resident);
    // Check signing configuration before creating an external session.
    if (!signingSecret()) throw didit.verificationError('VERIFICATION_NOT_CONFIGURED', 'Identity verification is not configured. Please contact the barangay office.');
    const session = await didit.createSession(req.resident.id, profile.id, `${origin}/verify/step3?verification=return`);
    const resumeToken = sign({
      purpose: 'didit-session', sub: req.resident.id,
      sessionVersion: req.resident.sessionVersion || 0, profileId: profile.id,
      sessionId: session.sessionId, workflowId: session.workflowId,
    }, '1h');
    res.json({ url: session.url, resumeToken });
  } catch (err) { didit.respondError(res, err, 'start'); }
};

exports.complete = async (req, res) => {
  try {
    const payload = readToken(req.body?.resumeToken, 'didit-session', req.resident);
    await currentProfile(req.resident, payload.profileId);
    const result = await verifiedResult(payload, req.resident);
    if (result.status === 'pending') {
      return res.status(202).json({ status: 'pending', message: result.providerStatus === 'In Review'
        ? 'Your identity check is being reviewed. You can return here and check the result later.'
        : 'Your verification is not finished yet. Complete the identity check, then check the result again.' });
    }
    const verificationProof = sign({
      purpose: 'didit-approved', sub: req.resident.id,
      sessionVersion: payload.sessionVersion, profileId: payload.profileId,
      sessionId: payload.sessionId, workflowId: payload.workflowId,
    }, '15m');
    res.json({ status: 'approved', verificationProof, idType: result.idType, idName: result.idName });
  } catch (err) { didit.respondError(res, err, 'complete'); }
};

async function saveImage(url, sessionId, kind) {
  const result = await cloudinary.uploader.upload(didit.mediaUrl(url), {
    resource_type: 'image', public_id: `irequestd/didit/${sessionId}/${kind}`, overwrite: true,
  });
  return result.secure_url;
}

exports.submit = async (req, res) => {
  try {
    const payload = readToken(req.body?.verificationProof, 'didit-approved', req.resident);
    const profile = await prisma.verificationProfile.findUnique({ where: { userId: req.resident.id } });
    // A retry after a lost HTTP response must not overwrite a staff decision.
    if (profile?.id === payload.profileId && profile.aiVerification?.sessionId === payload.sessionId &&
        reviewStatuses.has(String(profile.status).toLowerCase())) {
      return res.json({ message: 'Verification already submitted for review', step: 3 });
    }
    await currentProfile(req.resident, payload.profileId);
    const result = await verifiedResult(payload, req.resident);
    if (result.status !== 'approved') {
      return res.status(409).json({ code: 'VERIFICATION_PENDING', message: 'Your identity check is still being processed. Please check the result again.' });
    }
    // Import only the images authenticated by Didit, never browser-supplied files/URLs.
    const [idFront, idBack, facePhoto] = await Promise.all([
      saveImage(result.idFront, payload.sessionId, 'id-front'),
      result.idBack ? saveImage(result.idBack, payload.sessionId, 'id-back') : Promise.resolve(''),
      saveImage(result.facePhoto, payload.sessionId, 'selfie'),
    ]);
    await prisma.$transaction(async (tx) => {
      const changed = await tx.user.updateMany({
        where: { id: req.resident.id, verificationStep: 2, isVerified: false,
          active: true, deletedAt: null, sessionVersion: payload.sessionVersion },
        data: { verificationStep: 3, verificationStatus: 'pending' },
      });
      if (changed.count !== 1) throw didit.verificationError('APPLICATION_CHANGED', 'Your application has changed. Reload this page to see its current status.', 409);
      const saved = await tx.verificationProfile.updateMany({
        where: { id: payload.profileId, userId: req.resident.id,
          status: { notIn: ['pending', 'Pending', 'under review', 'approved', 'Approved'] } },
        data: {
          idType: result.idType, idName: result.idName, idFront, idBack, facePhoto,
          currentStep: 3, status: 'Pending', submittedAt: new Date(),
          aiVerification: result.summary,
        },
      });
      if (saved.count !== 1) throw didit.verificationError('APPLICATION_CHANGED', 'Your application has changed. Reload this page to see its current status.', 409);
    });
    res.json({ message: 'Verification submitted for review', step: 3 });
  } catch (err) { didit.respondError(res, err, 'submit'); }
};

exports.legacy = (_req, res) => res.status(409).json({
  message: 'Identity verification has been updated. Please refresh this page to continue.',
});
