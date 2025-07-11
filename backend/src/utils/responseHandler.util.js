/**
 * Utility class for consistent API responses
 */
class ResponseHandler {
  /**
   * Success response
   * @param {Object} res - Express response object
   * @param {number} statusCode - HTTP status code
   * @param {string} message - Success message
   * @param {Object} data - Response data
   */
  static success(res, message = 'Success', data = null, statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      ...(data && { data })
    });
  }

  /**
   * Error response
   * @param {Object} res - Express response object
   * @param {number} statusCode - HTTP status code
   * @param {string} error - Error type
   * @param {string} message - Error message
   * @param {Error} errorObj - Error object for stack trace
   */
  static error(res, statusCode = 500, error = 'Internal Server Error', message = 'Something went wrong', errorObj = null) {
    const response = {
      success: false,
      error,
      message
    };

    if (process.env.NODE_ENV === 'development' && errorObj && errorObj.stack) {
      response.stackTrace = errorObj.stack;
    }

    return res.status(statusCode).json(response);
  }

  /**
   * Validation error response
   * @param {Object} res - Express response object
   * @param {string} message - Validation error message
   * @param {Error} errorObj - Error object for stack trace
   */
  static validationError(res, message = 'Validation failed', errorObj = null) {
    return this.error(res, 400, 'Validation Error', message, errorObj);
  }

  /**
   * Authentication error response
   * @param {Object} res - Express response object
   * @param {string} message - Authentication error message
   * @param {Error} errorObj - Error object for stack trace
   */
  static authError(res, message = 'Authentication failed', errorObj = null) {
    return this.error(res, 401, 'Authentication Failed', message, errorObj);
  }

  /**
   * Authorization error response
   * @param {Object} res - Express response object
   * @param {string} message - Authorization error message
   * @param {Error} errorObj - Error object for stack trace
   */
  static forbiddenError(res, message = 'Access denied', errorObj = null) {
    return this.error(res, 403, 'Access Denied', message, errorObj);
  }

  /**
   * Not found error response
   * @param {Object} res - Express response object
   * @param {string} message - Not found error message
   * @param {Error} errorObj - Error object for stack trace
   */
  static notFoundError(res, message = 'Resource not found', errorObj = null) {
    return this.error(res, 404, 'Not Found', message, errorObj);
  }
}

module.exports = ResponseHandler; 