const prisma = require('../../lib/prisma');
const { isUuid } = require('../../lib/ids');
const { toApi } = require('../../lib/serialize');
const { updateResidentContact } = require('../../lib/residentContact');

exports.update = async (req, res) => {
  if (!isUuid(req.params.id)) return res.status(404).json({ message: 'Resident profile not found.' });
  try {
    const profile = await updateResidentContact(prisma, req.params.id, req.body, req.user);
    res.json(toApi(profile));
  } catch (error) {
    if (error.code === 'P2002') {
      const target = String(error.meta?.target || '');
      const field = ['email', 'contactNumber'].find((key) => target.includes(key));
      return res.status(409).json({ message: 'That email or contact number is already registered to another resident.', ...(field ? { field } : {}) });
    }
    if (error.code === 'P2025') return res.status(409).json({ message: 'This resident changed. Reopen the profile and try again.' });
    res.status(error.status || 500).json({
      message: error.status ? error.message : 'Could not save contact details. Please try again.',
      ...(error.field ? { field: error.field } : {}),
    });
  }
};
