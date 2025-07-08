const express = require("express");
const router = express.Router();
const {
  register,
  login,
  getProfile,
} = require("../controllers/auth.controller");
const { auth, isAdmin } = require("../middleware/auth.middleware");
const {
  registerValidation,
  loginValidation,
} = require("../middleware/validation.middleware");

// Public routes
router.post("/login", loginValidation, login);

// Protected routes
router.get("/profile", auth, getProfile);
router.post("/register", auth, isAdmin, registerValidation, register);

module.exports = router;
