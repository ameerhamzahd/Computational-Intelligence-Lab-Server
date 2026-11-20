const express = require('express');
const shareController = require('../controllers/shareController');

const router = express.Router();

router.get('/:token', shareController.getPublicContributions);

module.exports = router;
