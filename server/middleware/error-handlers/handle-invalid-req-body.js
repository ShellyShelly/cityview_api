const bodyParser = require('body-parser');


const addRawBody = async (req, res, buf) => {
  req.rawBody = buf.toString();
};

const handleInvalidReqBody = async (req, res, next) => {
  bodyParser.json({
    verify: await addRawBody,
  })(req, res, (err) => {
    if (err) res.status(400).send({ code: 400, status: 'BAD_REQUEST', message: 'Request body is not valid JSON' });
    else next();
  });
};


module.exports.handleInvalidReqBody = handleInvalidReqBody;
