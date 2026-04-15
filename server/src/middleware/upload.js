const multer = require('multer');
const cloudinary = require('../config/cloudinary');

// Store file in memory, then stream it to Cloudinary
const memoryStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (/jpeg|jpg|png|pdf/i.test(file.mimetype)) return cb(null, true);
  cb(new Error('Only JPG, PNG, or PDF files are allowed'));
};

// Single-field multer instance (memory)
const multerUpload = multer({
  storage: memoryStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// Helper: stream a buffer to Cloudinary and return the result
const streamToCloudinary = (buffer, folder, resourceType = 'auto') =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(buffer);
  });

// Middleware factory: multer.single → upload buffer → attach result to req.cloudinary
const uploadToCloudinary = (field, folder, resourceType = 'auto') => [
  multerUpload.single(field),
  async (req, res, next) => {
    if (!req.file) return next();
    try {
      const result = await streamToCloudinary(req.file.buffer, folder, resourceType);
      req.cloudinary = result; // { secure_url, public_id, ... }
      next();
    } catch (err) {
      next(err);
    }
  },
];

module.exports = { uploadToCloudinary };
