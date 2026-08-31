const jwt = require('jsonwebtoken');
const prisma = require('../../lib/prisma');
const { comparePassword } = require('../../lib/password');
const { toApi } = require('../../lib/serialize');
const residentCtrl = require('./resident.auth.controller');

const signToken = (id) => {
  if (!process.env.JWT_SECRET) return id.toString();
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
};

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
    const user = await prisma.admin.findUnique({
      where: { email: String(email).toLowerCase().trim() },
    });
    // OAuth-only accounts have no local password to compare against.
    if (!user || !user.password || !(await comparePassword(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const token = signToken(user.id);
    res.json({
      token,
      user: {
        // `_id` is kept because the React client reads it.
        _id: user.id,
        id: user.id,
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
  res.json(toApi(req.user));
};
