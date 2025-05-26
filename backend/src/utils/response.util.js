const successResponse = (res, message = 'Success', data = {}, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    statusCode
  });
};

const errorResponse = (res, message = 'Error occurred', data = {}, statusCode = 500) => {
  return res.status(statusCode).json({
    success: false,
    message,
    data,
    statusCode
  });
};

module.exports = {
  successResponse,
  errorResponse
}; 