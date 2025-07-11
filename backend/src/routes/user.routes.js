const express = require('express');
const router = express.Router();
const { getUsers, getCurrentUser } = require('../controllers/user.controller');
const { auth, isAdmin } = require('../middleware/auth.middleware');
const userController = require('../controllers/user.controller');

router.get('/', auth, getUsers);
router.get('/me', auth, getCurrentUser);
router.put('/:id', auth, isAdmin, userController.updateUser);

module.exports = router; 