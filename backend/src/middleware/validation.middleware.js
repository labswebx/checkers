const { body } = require('express-validator');
const { USER_ROLES } = require('../constants');

const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('name')
    .notEmpty()
    .withMessage('Name is required'),
  body('contactNumber')
    .matches(/^[0-9]{10}$/)
    .withMessage('Please enter a valid 10-digit contact number'),
  body('role')
    .optional()
    .isIn([USER_ROLES.ADMIN, USER_ROLES.AGENT])
    .withMessage('Invalid role specified')
];

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

module.exports = {
  registerValidation,
  loginValidation
}; 