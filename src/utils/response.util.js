const { STATUS_CODES } = require('../constants/app.constants');

const successResponse = (res, message, data = null, statusCode = STATUS_CODES.SUCCESS) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const errorResponse = (res, message, error = null, statusCode = STATUS_CODES.INTERNAL_SERVER_ERROR) => {
  const response = {
    success: false,
    message,
  };
  if (error && process.env.NODE_ENV === 'development') {
    response.error = error.message || error;
  }
  return res.status(statusCode).json(response);
};

module.exports = {
  successResponse,
  errorResponse,
};
