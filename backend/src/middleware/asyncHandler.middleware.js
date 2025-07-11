/**
 * Async error handler middleware
 * Wraps async controller functions to automatically handle try-catch logic
 * @param {Function} theFunc - The async controller function
 * @returns {Function} - Express middleware function
 */
module.exports = theFunc => (req, res, next) => {
  Promise.resolve(theFunc(req, res, next)).catch(next);
}; 