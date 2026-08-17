const { PAGINATION } = require('../constants/app.constants');

/**
 * Parse pagination params from a query object into { page, limit, skip }.
 */
const parsePagination = (query = {}) => {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (Number.isNaN(page) || page < 1) page = PAGINATION.DEFAULT_PAGE;
  if (Number.isNaN(limit) || limit < 1) limit = PAGINATION.DEFAULT_LIMIT;
  if (limit > PAGINATION.MAX_LIMIT) limit = PAGINATION.MAX_LIMIT;

  return { page, limit, skip: (page - 1) * limit };
};

/**
 * Build a standard paginated payload.
 */
const buildPaginatedResult = (items, total, page, limit) => ({
  items,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  },
});

module.exports = {
  parsePagination,
  buildPaginatedResult,
};
