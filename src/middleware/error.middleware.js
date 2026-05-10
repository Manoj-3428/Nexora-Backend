const { STATUS_CODES, MESSAGES } = require('../constants/app.constants');
const { errorResponse } = require('../utils/response.util');
const logger = require('../utils/logger.util');

const errorHandler = (err, req, res, next) => {
  logger.error(`${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);

  const statusCode = res.statusCode === STATUS_CODES.SUCCESS ? STATUS_CODES.INTERNAL_SERVER_ERROR : res.statusCode;
  const message = err.message || MESSAGES.SERVER_ERROR;

  return errorResponse(res, message, err, statusCode);
};

// Handle 404
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(STATUS_CODES.NOT_FOUND);
  next(error);
};

module.exports = {
  errorHandler,
  notFoundHandler,
};
