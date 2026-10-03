const { residentRevocationData } = require('./accountLifecycle');

const CONTACT_USER_SELECT = {
  id: true, email: true, contactNumber: true, createdAt: true, updatedAt: true, deletedAt: true,
};
const PROFILE_CONTACT_INCLUDE = { user: { select: CONTACT_USER_SELECT } };

function contactProfile(profile) {
  if (!profile?.user) return profile;
  // The resident account is the source used by login recovery and both apps.
  return { ...profile, email: profile.user.email, contactNumber: profile.user.contactNumber };
}

function fail(status, message, field) {
  throw Object.assign(new Error(message), { status, ...(field ? { field } : {}) });
}

function validateContact(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(400, 'Contact details are required.');
  if (Object.keys(input).some((key) => !['email', 'contactNumber', 'expectedUpdatedAt'].includes(key))) {
    fail(400, 'Only email and contact number can be edited here.');
  }
  const data = {};
  if (Object.hasOwn(input, 'email')) {
    if (input.email !== null && typeof input.email !== 'string') fail(400, 'Enter a valid email address.', 'email');
    const email = (input.email || '').trim().toLowerCase();
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) fail(400, 'Enter a valid email address.', 'email');
    data.email = email || null;
  }
  if (Object.hasOwn(input, 'contactNumber')) {
    if (typeof input.contactNumber !== 'string') fail(400, 'Enter a valid Philippine mobile number.', 'contactNumber');
    let number = input.contactNumber.trim().replace(/[\s()-]/g, '');
    if (/^\+?639\d{9}$/.test(number)) number = '0' + number.replace(/^\+?63/, '');
    if (!/^09\d{9}$/.test(number)) fail(400, 'Use 09XXXXXXXXX or +639XXXXXXXXX.', 'contactNumber');
    data.contactNumber = number;
  }
  if (!Object.keys(data).length) fail(400, 'Enter an email address or contact number to update.');
  if (input.expectedUpdatedAt !== undefined &&
      (typeof input.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(input.expectedUpdatedAt)))) {
    fail(400, 'Reload the resident profile and try again.');
  }
  return data;
}

async function updateResidentContact(prisma, id, input, actor) {
  const changes = validateContact(input);
  return prisma.$transaction(async (tx) => {
    const profile = await tx.verificationProfile.findUnique({ where: { id }, include: PROFILE_CONTACT_INCLUDE });
    if (!profile?.user) fail(404, 'Resident profile not found.');
    const user = profile.user;
    if (user.deletedAt) fail(409, 'Deleted resident accounts cannot be edited.');
    if (input.expectedUpdatedAt && new Date(input.expectedUpdatedAt).getTime() !== new Date(user.updatedAt).getTime()) {
      fail(409, 'This resident was updated by someone else. Reopen the profile and try again.');
    }

    const data = {
      email: Object.hasOwn(changes, 'email') ? changes.email : user.email,
      contactNumber: changes.contactNumber ?? user.contactNumber,
    };
    const accountFields = Object.keys(data).filter((key) => data[key] !== user[key]);
    const profileFields = Object.keys(data).filter((key) => data[key] !== profile[key]);
    if (!accountFields.length && !profileFields.length) return contactProfile(profile);

    if (accountFields.length) {
      for (const field of accountFields) {
        if (!data[field]) continue;
        const duplicate = await tx.user.findFirst({
          where: {
            id: { not: user.id },
            [field]: field === 'email' ? { equals: data.email, mode: 'insensitive' } : data.contactNumber,
          },
          select: { id: true },
        });
        if (duplicate) fail(409, field === 'email' ? 'Email is already registered to another resident.' : 'Contact number is already registered to another resident.', field);
      }
    }
    // Contact edits are trusted staff corrections. Preserve verification and
    // activity, but invalidate sessions/recovery issued for the old contacts.
    // Lock the account even for a legacy profile-only synchronization so it
    // cannot race a contact correction made through another request.
    const changed = await tx.user.updateMany({
      where: { id: user.id, updatedAt: user.updatedAt, deletedAt: null },
      data: { ...data, ...(accountFields.length ? residentRevocationData() : {}) },
    });
    if (changed.count !== 1) fail(409, 'This resident was updated by someone else. Reopen the profile and try again.');
    if (accountFields.length) await tx.otpCode.deleteMany({ where: { userId: user.id } });
    const updated = await tx.verificationProfile.update({ where: { id }, data, include: PROFILE_CONTACT_INCLUDE });
    await tx.auditTrail.create({ data: {
      adminId: actor.id, username: actor.fullName, role: actor.role,
      action: 'Updated Resident Contact Details',
      details: `Resident: ${profile.fullName} (${user.id}). Updated fields: ${[...new Set([...accountFields, ...profileFields])].join(', ')}.`,
    } });
    return contactProfile(updated);
  });
}

module.exports = { PROFILE_CONTACT_INCLUDE, contactProfile, updateResidentContact };
