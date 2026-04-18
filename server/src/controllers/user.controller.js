const User = require('../models/User');

// GET /api/users/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/users/me  – update own profile & optionally change password
exports.updateMe = async (req, res) => {
  try {
    const { fullName, purok, email, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (fullName) user.fullName = fullName;
    if (purok)    user.purok   = purok;
    if (email)    user.email   = email;

    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ message: 'Current password is required' });
      const ok = await user.comparePassword(currentPassword);
      if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });
      user.password = newPassword;
    }

    await user.save();
    const { password: _, ...safe } = user.toObject();
    res.json(safe);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/users  (Secretary / Barangay Captain)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/users/:id
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/users/:id/role  – Barangay Captain promotes/changes staff role
exports.updateRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
