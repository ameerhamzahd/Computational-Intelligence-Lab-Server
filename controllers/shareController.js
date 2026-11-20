const crypto = require('crypto');
const catchAsync = require('../middleware/catchAsync');
const AppError = require('../utils/appError');
const {
  getShareToken,
  setShareTokenIfMissing,
  clearShareToken,
  findUserByShareToken,
} = require('../models/userModel');
const { findApprovedUploadsByUser } = require('../models/uploadModel');

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

function newToken() {
  return crypto.randomBytes(12).toString('base64url');
}

// Owner endpoints ------------------------------------------------------------

exports.getShare = catchAsync(async (req, res) => {
  res.json({ success: true, token: await getShareToken(req.user.id) });
});

// Idempotent: returns the existing link, or creates one on first click.
exports.createShare = catchAsync(async (req, res) => {
  const token = await setShareTokenIfMissing(req.user.id, newToken());
  res.json({ success: true, token });
});

exports.revokeShare = catchAsync(async (req, res) => {
  await clearShareToken(req.user.id);
  res.json({ success: true, token: null });
});

// Public endpoint ------------------------------------------------------------

function serializeUpload(upload) {
  const fileRoute = upload.upload_type === 'paper' ? 'pdf' : 'presentation';
  return { ...upload, cloudinary_url: `/api/research/${upload.id}/${fileRoute}` };
}

exports.getPublicContributions = catchAsync(async (req, res, next) => {
  const { token } = req.params;
  const user = TOKEN_PATTERN.test(token) ? await findUserByShareToken(token) : null;
  if (!user) return next(new AppError('This link is invalid or sharing has been turned off.', 404));

  const uploads = await findApprovedUploadsByUser(user.id, user.email);
  res.set('Cache-Control', 'no-store');
  res.json({
    success: true,
    profile: {
      name: user.name,
      email: user.email,
      scholarId: user.scholar_id,
      institution: user.institution,
      role: user.role,
      avatarUrl: user.avatar_url || null,
    },
    papers: uploads.filter((u) => u.upload_type === 'paper').map(serializeUpload),
    presentations: uploads.filter((u) => u.upload_type === 'presentation').map(serializeUpload),
  });
});
