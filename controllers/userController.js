const bcrypt = require('bcrypt');
const catchAsync = require('../middleware/catchAsync');
const AppError = require('../utils/appError');
const {
  getUserById,
  findUserByEmail,
  findUserByScholarId,
  updateUserProfile,
  findUsers,
  setAvatar,
  getAvatarPublicId,
  clearAvatar,
} = require('../models/userModel');
const { uploadBuffer, destroyResource } = require('../config/cloudinary');
const { createToken } = require('./authController');
const { findLatestRequestByUserId } = require('../models/memberRequestModel');

function serializeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    scholarId: user.scholar_id,
    institution: user.institution,
    role: user.role,
    appRole: user.app_role,
    avatarUrl: user.avatar_url || null,
  };
}

function serializeCollaborator(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    institution: user.institution,
    role: user.role,
    appRole: user.app_role,
  };
}

exports.listCollaborators = catchAsync(async (req, res) => {
  const users = await findUsers({ ...req.query, status: 'active', appRole: 'MEMBER', sort: 'name' });
  const collaborators = users
    .filter((user) => user.id !== req.user.id)
    .map(serializeCollaborator);

  res.json({ success: true, users: collaborators });
});

exports.getProfile = catchAsync(async (req, res) => {
  const user = await getUserById(req.user.id);
  const request = await findLatestRequestByUserId(req.user.id);

  const roleChanged = req.tokenPayload && req.tokenPayload.appRole !== user.app_role;
  res.json({
    success: true,
    ...(roleChanged ? { token: createToken(user) } : {}),
    user: { ...serializeUser(user), memberRequest: request ? {
      id: request.id,
      status: request.status,
      createdAt: request.created_at,
      decidedAt: request.decided_at || undefined,
    } : null },
  });
});

exports.updateProfile = catchAsync(async (req, res, next) => {
  const allowed = ['name', 'email', 'scholarId', 'institution', 'role'];
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  if (changes.name !== undefined && (!String(changes.name).trim() || String(changes.name).trim().length < 2)) {
    return next(new AppError('Name must be at least 2 characters.', 400));
  }
  if (changes.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(changes.email).trim())) {
    return next(new AppError('Please provide a valid email address.', 400));
  }
  if (changes.scholarId !== undefined && !String(changes.scholarId).trim()) {
    return next(new AppError('Scholar ID is required.', 400));
  }
  if (changes.institution !== undefined && !String(changes.institution).trim()) {
    return next(new AppError('Institution is required.', 400));
  }
  if (changes.role !== undefined && !String(changes.role).trim()) {
    return next(new AppError('Academic role is required.', 400));
  }
  if (req.body.password !== undefined && (typeof req.body.password !== 'string' || req.body.password.length < 8)) {
    return next(new AppError('Password must be at least 8 characters.', 400));
  }
  if (req.body.password) changes.password = await bcrypt.hash(String(req.body.password), 12);
  if (changes.email) {
    const existing = await findUserByEmail(String(changes.email).toLowerCase().trim());
    if (existing && existing.id !== req.user.id) return next(new AppError('Email is already registered.', 409));
  }
  if (changes.scholarId) {
    const existing = await findUserByScholarId(String(changes.scholarId).trim());
    if (existing && existing.id !== req.user.id) return next(new AppError('Scholar ID is already registered.', 409));
  }
  const user = await updateUserProfile(req.user.id, changes);
  if (!user) return next(new AppError('No profile changes were provided.', 400));
  res.json({ success: true, message: 'Profile updated successfully.', user: serializeUser(user) });
});

// Best effort: a failed cleanup must never fail the user's request.
async function discardImage(publicId) {
  if (!publicId) return;
  try {
    await destroyResource(publicId, { resource_type: 'image', invalidate: true });
  } catch (err) {
    console.error('Failed to delete old avatar:', err.message);
  }
}

exports.uploadAvatar = catchAsync(async (req, res, next) => {
  if (!req.file) return next(new AppError('Choose an image to upload.', 400));

  const result = await uploadBuffer(req.file.buffer, {
    folder: 'cilab/avatars',
    resource_type: 'image',
    public_id: `${req.user.id}-${Date.now()}`,
    overwrite: false,
    // Square, face-centred crop so every avatar renders consistently.
    transformation: [{ width: 512, height: 512, crop: 'fill', gravity: 'face' }],
    quality: 'auto',
    fetch_format: 'auto',
  });

  const saved = await setAvatar(req.user.id, result.secure_url, result.public_id);
  if (!saved) {
    await discardImage(result.public_id);
    return next(new AppError('User not found.', 404));
  }
  await discardImage(saved.previous_public_id);

  res.json({ success: true, message: 'Profile photo updated.', avatarUrl: saved.avatar_url });
});

exports.deleteAvatar = catchAsync(async (req, res) => {
  const publicId = await getAvatarPublicId(req.user.id);
  await clearAvatar(req.user.id);
  await discardImage(publicId);
  res.json({ success: true, message: 'Profile photo removed.', avatarUrl: null });
});
