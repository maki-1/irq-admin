const prisma = require('../../lib/prisma');
const { toApi } = require('../../lib/serialize');
const { isUuid } = require('../../lib/ids');

// GET /api/notifications  – own notifications
exports.getNotifications = async (req, res) => {
  try {
    const notes = await prisma.notification.findMany({
      where: { adminId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(toApi(notes));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/notifications/:id/read
exports.markRead = async (req, res) => {
  try {
    if (!isUuid(req.params.id)) return res.json(null);

    // Scoped to the caller so one admin cannot mark another's notification read.
    const { count } = await prisma.notification.updateMany({
      where: { id: req.params.id, adminId: req.user.id },
      data: { status: 'Read' },
    });
    if (count === 0) return res.json(null);

    const note = await prisma.notification.findUnique({ where: { id: req.params.id } });
    res.json(toApi(note));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/notifications/read-all
exports.markAllRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { adminId: req.user.id, status: 'Unread' },
      data: { status: 'Read' },
    });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
