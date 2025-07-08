const { body } = require('express-validator');
const { USER_ROLES } = require('../constants');
const ResponseHandler = require('../utils/responseHandler.util');

/**
 * Generic validation middleware for request validation
 * @param {Object} schema - Validation schema object
 * @returns {Function} - Express middleware function
 */
const validateRequest = (schema) => {
  return (req, res, next) => {
    const errors = [];

    // Validate body parameters
    if (schema.body) {
      Object.keys(schema.body).forEach(field => {
        const rules = schema.body[field];
        const value = req.body[field];

        if (rules.required && (value === undefined || value === null || value === '')) {
          errors.push(`${field} is required`);
          return;
        }

        if (value !== undefined && value !== null) {
          // Type validation
          if (rules.type === 'string' && typeof value !== 'string') {
            errors.push(`${field} must be a string`);
          }

          if (rules.type === 'number' && typeof value !== 'number') {
            errors.push(`${field} must be a number`);
          }

          if (rules.type === 'boolean' && typeof value !== 'boolean') {
            errors.push(`${field} must be a boolean`);
          }

          // String-specific validations
          if (rules.type === 'string' && typeof value === 'string') {
            // Min length validation
            if (rules.minLength && value.length < rules.minLength) {
              errors.push(`${field} must be at least ${rules.minLength} characters long`);
            }

            // Max length validation
            if (rules.maxLength && value.length > rules.maxLength) {
              errors.push(`${field} must be no more than ${rules.maxLength} characters long`);
            }

            // Email validation
            if (rules.email && !Constants.REGEX.EMAIL.test(value)) {
              errors.push(`${field} must be a valid email address`);
            }

            // Enum validation
            if (rules.enum && !rules.enum.includes(value)) {
              errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
            }

            // Regex validation
            if (rules.pattern && !rules.pattern.test(value)) {
              errors.push(`${field} format is invalid`);
            }
          }

          // Number-specific validations
          if (rules.type === 'number' && typeof value === 'number') {
            if (rules.min !== undefined && value < rules.min) {
              errors.push(`${field} must be at least ${rules.min}`);
            }

            if (rules.max !== undefined && value > rules.max) {
              errors.push(`${field} must be no more than ${rules.max}`);
            }
          }
        }
      });
    }

    // Validate query parameters
    if (schema.query) {
      Object.keys(schema.query).forEach(field => {
        const rules = schema.query[field];
        const value = req.query[field];

        if (rules.required && (value === undefined || value === null || value === '')) {
          errors.push(`${field} is required`);
          return;
        }

        if (value !== undefined && value !== null) {
          // Type validation
          if (rules.type === 'string' && typeof value !== 'string') {
            errors.push(`${field} must be a string`);
          }

          if (rules.type === 'number' && isNaN(Number(value))) {
            errors.push(`${field} must be a number`);
          }

          // String-specific validations
          if (rules.type === 'string' && typeof value === 'string') {
            if (rules.minLength && value.length < rules.minLength) {
              errors.push(`${field} must be at least ${rules.minLength} characters long`);
            }

            if (rules.maxLength && value.length > rules.maxLength) {
              errors.push(`${field} must be no more than ${rules.maxLength} characters long`);
            }

            if (rules.enum && !rules.enum.includes(value)) {
              errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
            }
          }
        }
      });
    }

    // Validate path parameters
    if (schema.params) {
      Object.keys(schema.params).forEach(field => {
        const rules = schema.params[field];
        const value = req.params[field];

        if (rules.required && (value === undefined || value === null || value === '')) {
          errors.push(`${field} is required`);
          return;
        }

        if (value !== undefined && value !== null) {
          // ObjectId validation for MongoDB IDs
          if (rules.type === 'ObjectId' && !require('mongoose').Types.ObjectId.isValid(value)) {
            errors.push(`${field} must be a valid ID`);
          }

          if (rules.type === 'string' && typeof value !== 'string') {
            errors.push(`${field} must be a string`);
          }
        }
      });
    }

    if (errors.length > 0) {
      return ResponseHandler.validationError(res, errors.join(', '));
    }
    next();
  };
};

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

const validateSuperLogin = (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return ResponseHandler.validationError(res, 'email is required');
  }
  if (!Constants.REGEX.EMAIL.test(email)) {
    return ResponseHandler.validationError(res, 'Please provide a valid email address');
  }
  next();
};

module.exports = {
  registerValidation,
  loginValidation,
  validateRequest,
  validateSuperLogin
}; 