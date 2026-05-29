const jwt = require('jsonwebtoken');
const User = require('../models/User');
const residentCtrl = require('./resident.auth.controller');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

// POST /api/auth/login — handles admin (email) and resident (username)
exports.login = async (req, res) => {
  try {
    const { email, username, password } = req.body;

    // Resident login when username is provided
    if (username && !email) {
      return residentCtrl.residentLogin(req, res);
    }

    // Admin login
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const token = signToken(user._id);
    res.json({
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        purok: user.purok,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  res.json(req.user);
};
