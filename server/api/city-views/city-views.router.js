const express = require('express');
const {
  getCityViewList, getCityViewDetail, createCityView,
} = require('./city-views.controller');
const {
  validateId, validateCityViewImage, validateCityView,
} = require('./city-views.validator');


const publicRouter = express.Router();
const privateRouter = express.Router();

// TODO: add e2e tests for all endpoints
publicRouter.get('/', getCityViewList);
publicRouter.get('/:id', validateId, getCityViewDetail);

privateRouter.post('/', validateCityView, validateCityViewImage, createCityView);


module.exports = {
  publicRouter,
  privateRouter,
};
