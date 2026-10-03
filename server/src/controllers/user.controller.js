const prisma = require('../../lib/prisma');
const { hashPassword, comparePassword } = require('../../lib/password');
const { toApi } = require('../../lib/serialize');
const { isUuid } = require('../../lib/ids');
const { notificationContact } = require('../../lib/notificationContact');

// Everything except the password hash (was .select('-password')).
const SAFE = {
  id: true, legacyId: true, fullName: true, purok: true, email: true,
  contactNumber: true, notifyEmail: true, active: true,
  role: true, oauthProvider: true, oauthId: true, createdAt: true, updatedAt: true,
};

// GET /api/users/me
exports.getMe = async (req, res) => {
  try {
    const user = await prisma.admin.findUnique({ where: { id: req.user.id }, select: SAFE });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(toApi(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/users/me  – update own profile & optionally change password
exports.updateMe = async (req, res) => {
  try {
    const { fullName, purok, email, contactNumber, notifyEmail, currentPassword, newPassword } = req.body;
    const user = await prisma.admin.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const data = {};
    if (fullName) data.fullName = fullName;
    if (purok)    data.purok    = purok;
    if (email)    data.email    = String(email).toLowerCase().trim();

    // Where approval alerts actually reach this person. Both clearable by
    // sending an empty string, so a wrong number can be removed.
    const contacts = notificationContact({ contactNumber, notifyEmail });
    if (contacts.error) return res.status(400).json({ message: contacts.error });
    Object.assign(data, contacts.data);

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ message: 'Current password is required' });
      // An OAuth-only account has no password to verify against.
      const ok = user.password && (await comparePassword(currentPassword, user.password));
      if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });
      data.password = await hashPassword(newPassword);
      data.sessionVersion = { increment: 1 };
    }

    const updated = await prisma.admin.update({
      where: { id: user.id, ...(newPassword ? { active: true, sessionVersion: req.user.sessionVersion } : {}) },
      data,
      select: SAFE,
    });
    res.json(toApi(updated));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/users  (Secretary / Barangay Captain)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.admin.findMany({ select: SAFE, orderBy: { createdAt: 'desc' } });
    res.json(toApi(users));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/users/:id
exports.getUser = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'User not found' });
    const user = await prisma.admin.findUnique({ where: { id: req.params.id }, select: SAFE });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(toApi(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/users/:id/role  – Barangay Captain promotes/changes staff role
// PATCH /api/users/:id  – Barangay Captain edits an account's editable fields.
// Contact number and notify email are the reason this exists: a Purok Leader
// created before those fields (or without them) can now be reached for SMS
// approvals without being deleted and recreated.
exports.updateUser = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'User not found' });
    const { fullName, contactNumber, notifyEmail, purok } = req.body;

    const data = {};
    if (fullName !== undefined) data.fullName = String(fullName).trim();
    if (purok !== undefined) data.purok = purok || '';
    const contacts = notificationContact({ contactNumber, notifyEmail });
    if (contacts.error) return res.status(400).json({ message: contacts.error });
    Object.assign(data, contacts.data);
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'Nothing to update.' });
    }

    const user = await prisma.admin
      .update({ where: { id: req.params.id }, data, select: SAFE })
      .catch((e) => {
        if (e.code === 'P2025') return null;
        throw e;
      });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(toApi(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'User not found' });

    const user = await prisma.admin
      .update({ where: { id: req.params.id }, data: { role }, select: SAFE })
      .catch((e) => {
        if (e.code === 'P2025') return null;
        throw e;
      });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(toApi(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/users  – Barangay Captain creates a new admin account
exports.createUser = async (req, res) => {
  try {
    const { fullName, purok, email, password, role, contactNumber, notifyEmail } = req.body;
    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    // A Purok Leader who cannot be reached will never see an approval request,
    // so at least one contact route is required when creating one.
    if (role === 'Purok Leader' && !contactNumber && !notifyEmail) {
      return res.status(400).json({
        message: 'A Purok Leader needs a contact number or a notification email — ' +
                 'they cannot be alerted to pending approvals otherwise.',
      });
    }
    const contacts = notificationContact({ contactNumber, notifyEmail });
    if (contacts.error) return res.status(400).json({ message: contacts.error });
    if (role === 'Purok Leader' && !contacts.data.contactNumber && !contacts.data.notifyEmail) {
      return res.status(400).json({ message: 'A Purok Leader needs a contact number or a notification email.' });
    }
    const normalised = String(email).toLowerCase().trim();
    const exists = await prisma.admin.findUnique({ where: { email: normalised } });
    if (exists) return res.status(409).json({ message: 'Email is already in use.' });

    const user = await prisma.admin.create({
      data: {
        fullName,
        purok: purok ?? '',
        email: normalised,
        password: await hashPassword(password),
        role,
        contactNumber: contacts.data.contactNumber || null,
        notifyEmail: contacts.data.notifyEmail || null,
      },
      select: SAFE,
    });
    res.status(201).json(toApi(user));
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'Email is already in use.' });
    }
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/users/:id/reset-password  – Barangay Captain resets any staff password
exports.resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'User not found.' });

    const updated = await prisma.admin
      .update({
        where: { id: req.params.id },
        data: { password: await hashPassword(newPassword), sessionVersion: { increment: 1 } },
      })
      .catch((e) => {
        if (e.code === 'P2025') return null;
        throw e;
      });
    if (!updated) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: 'Password reset successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/users/:id/active  – Barangay Captain deactivates/reactivates an
// account. Accounts are never hard-deleted: a deactivated staff member keeps
// their audit trail and past approvals, and can be restored, but cannot log in.
exports.setActive = async (req, res) => {
  try {
    if (req.params.id === String(req.user.id)) {
      return res.status(400).json({ message: 'You cannot deactivate your own account.' });
    }
    if (!isUuid(req.params.id)) return res.status(404).json({ message: 'User not found.' });

    const { active } = req.body;
    if (typeof active !== 'boolean') {
      return res.status(400).json({ message: 'active must be true or false.' });
    }

    const existing = await prisma.admin.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existing) return res.status(404).json({ message: 'User not found.' });

    const user = await prisma.admin.update({
      where: { id: req.params.id },
      data: { active, sessionVersion: { increment: 1 } },
      select: SAFE,
    });
    res.json(toApi(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
