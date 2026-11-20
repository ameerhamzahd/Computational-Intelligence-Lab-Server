const express = require('express');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');
const shareController = require('../controllers/shareController');
const upload = require('../middleware/upload');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.post('/register', authController.register);
router.post('/verify-registration', authController.verifyRegistration);
router.post('/login', authController.login);
router.post('/forgot-password', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);
router.get('/users', authenticate, userController.listCollaborators);
router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, userController.updateProfile);
router.put('/profile/avatar', authenticate, upload.imageUpload.single('avatar'), userController.uploadAvatar);
router.delete('/profile/avatar', authenticate, userController.deleteAvatar);
router.get('/profile/share', authenticate, shareController.getShare);
router.post('/profile/share', authenticate, shareController.createShare);
router.delete('/profile/share', authenticate, shareController.revokeShare);

module.exports = router;
