const poolItemService = require('../services/poolItem.service');
const { successResponse, errorResponse } = require('../utils/response.util');
const { STATUS_CODES } = require('../constants/app.constants');

const addPoolItem = async (req, res) => {
  try {
    const item = await poolItemService.addPoolItem(req.user, req.params.poolId, req.body);
    return successResponse(res, 'Item added to pool', item, STATUS_CODES.CREATED);
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.BAD_REQUEST);
  }
};

const removePoolItem = async (req, res) => {
  try {
    await poolItemService.removePoolItem(req.user, req.params.poolId, req.params.itemId);
    return successResponse(res, 'Item removed from pool');
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.BAD_REQUEST);
  }
};

const updateItemMetadata = async (req, res) => {
  try {
    const item = await poolItemService.updateItemMetadata(req.user, req.params.poolId, req.params.itemId, req.body);
    return successResponse(res, 'Item metadata updated', item);
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.BAD_REQUEST);
  }
};

const fetchPoolItems = async (req, res) => {
  try {
    const items = await poolItemService.fetchPoolItems(req.params.poolId, req.query);
    return successResponse(res, 'Pool items retrieved', items);
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.INTERNAL_SERVER_ERROR);
  }
};

const fetchItemDetails = async (req, res) => {
  try {
    const item = await poolItemService.fetchItemDetails(req.params.poolId, req.params.itemId);
    return successResponse(res, 'Item details retrieved', item);
  } catch (error) {
    return errorResponse(res, error.message, error, STATUS_CODES.NOT_FOUND);
  }
};

module.exports = {
  addPoolItem,
  removePoolItem,
  updateItemMetadata,
  fetchPoolItems,
  fetchItemDetails,
};
