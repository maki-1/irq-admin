const jwt = require('jsonwebtoken');
const ResidentUser = require('../models/ResidentUser');

const residentProtect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'resident') {
      return res.status(403).json({ message: 'Resident access only' });
    }
    const user = await ResidentUser.findById(decoded.id).lean();
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.resident = user;
    next();
  } catch {
    res.status(401).json({ message: 'Token invalid or expired' });
  }
};

module.exports = { residentProtect };
