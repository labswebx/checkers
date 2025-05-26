const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboard.controller');
const { auth } = require('../middleware/auth.middleware');

router.get('/stats', auth, getDashboardStats);

module.exports = router; 