const { errorResponse } = require('../utils/response.util');
const { STATUS_CODES } = require('../constants/app.constants');

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    const errorMessage = error.details.map((details) => details.message).join(', ');
    return errorResponse(res, errorMessage, null, STATUS_CODES.BAD_REQUEST);
  }
  next();
};

module.exports = validate;
