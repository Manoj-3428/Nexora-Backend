const { STATUS_CODES } = require('../constants/app.constants');

const successResponse = (res, message, data = null, statusCode = STATUS_CODES.SUCCESS) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const errorResponse = (res, message, error = null, statusCode = STATUS_CODES.INTERNAL_SERVER_ERROR, code = null) => {
  const response = {
    success: false,
    message,
  };

  // Prefer an explicit code, otherwise fall back to a code attached to the thrown error.
  const resolvedCode = code || (error && error.code) || null;
  if (resolvedCode) {
    response.code = resolvedCode;
  }

  if (error && process.env.NODE_ENV === 'development') {
    response.error = error.message || error;
  }
  return res.status(statusCode).json(response);
};

/**
 * Domain error carrying an HTTP status + stable machine code.
 * Services throw this; controllers/handlers can read status/code off it.
 */
class AppError extends Error {
  constructor(message, statusCode = STATUS_CODES.BAD_REQUEST, code = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

module.exports = {
  successResponse,
  errorResponse,
  AppError,
};
