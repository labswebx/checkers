const express = require('express');
const router = express.Router();
const { getUsers } = require('../controllers/user.controller');
const { auth, isAdmin } = require('../middleware/auth.middleware');
const userController = require('../controllers/user.controller');

router.get('/', auth, getUsers);
router.put('/:id', auth, isAdmin, userController.updateUser);

module.exports = router; 