const multer = require('multer');
const AppError = require('../utils/appError');

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new AppError('Only PDF, PPT, or PPTX files are allowed.', 400));
    }
    callback(null, true);
  },
});

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (file.mimetype !== 'application/pdf') {
      return callback(new AppError('Only PDF files are allowed.', 400));
    }
    callback(null, true);
  },
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return callback(new AppError('Only JPG, PNG, or WebP images are allowed.', 400));
    }
    callback(null, true);
  },
});

module.exports = upload;
module.exports.imageUpload = imageUpload;
module.exports.pdfUpload = pdfUpload;
module.exports.replacementUpload = upload.fields([
  { name: 'paper_file', maxCount: 1 },
  { name: 'presentation_file', maxCount: 1 },
]);
