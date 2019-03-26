const express = require('express');
const passport = require('passport');
const bodyParser = require('body-parser');
const { handleInvalidReqBody } = require('./middleware/error-handlers/handle-invalid-req-body');
const { handleError } = require('./middleware/error-handlers/handle-error');
const { handle404Error } = require('./middleware/error-handlers/handle-404');
const apiRouter = require('./api/api.router');
require('../config/passport-google-setup');
require('../config/passport-facebook-setup');


const app = express();

app.use(passport.initialize());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(handleInvalidReqBody);
app.use('/', apiRouter);
app.use(handle404Error);
app.use(handleError);


module.exports = app;
