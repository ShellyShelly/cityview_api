/* eslint-disable no-param-reassign */
const nodemailer = require('nodemailer');
const { JWK, JWE } = require('node-jose');
const smtpTransport = require('nodemailer-smtp-transport');

const { user } = require('./users.service');
const { redisClient } = require('../../config/redis-setup');


const {
  EMAIL_PASSWORD, GMAIL_ADDRESS,
} = process.env;

// initialize JWK
const DEV_JWK = {
  kty: 'oct', // Key Type
  /*
  The "kty" (key type) parameter identifies the cryptographic algorithm
   family used with the key, such as "RSA" or "EC".
  */
  kid: 1, // (key ID) parameter is used to match a specific key.
  use: 'enc', // used for encrypting data
  alg: 'A256GCM', // it's AES GCM algorithm(using 256-bit key)
  k: process.env.JWK_PASSWORD,
  /*
  The field "k" value is the symmetric key.

   For the content encryption algorithm "A256GCM", the field "k" value
   is exactly 32 octets in length when decoded, padded with leading zero
   (0x00) octets to reach the expected length.
  */

};

// eslint-disable-next-line consistent-return
const googleAuthStrategyHandler = async (request, accessToken, refreshToken, profile, done) => {
  const userResult = await user.findOne({ googleId: profile.id }).catch((error) => {
    console.error('Google userResult | error: ', error);
    done(error);
  });
  if (!userResult) { // user does not exist
    if (profile.id) {
      const newUser = await user.create({
        username: profile.displayName,
        googleId: profile.id,
        avatarUrl: profile.photos[0].value,
        isActive: true,
        isEmployee: false,
      }).catch((error) => {
        console.error('Google newUser | error: ', error);
        return done(error);
      });
      if (typeof newUser !== 'undefined') done(null, newUser);
    } else {
      const error = Error('profile.id wasn`t found');
      error.code = 'GOOGLE_AUTH_FAILED';
      done(error);
    }
  } else { // user already exists
    return done(null, userResult);
  }
};

// eslint-disable-next-line consistent-return
const facebookAuthStrategyHandler = async (accessToken, refreshToken, profile, done) => {
  const userResult = await user.findOne({ facebookId: profile.id }).catch((error) => {
    console.error('Facebook userResult | error: ', error);
    done(error);
  });
  if (!userResult) { // user does not exist
    if (profile.id) {
      const newUser = await user.create({
        name: profile.displayName,
        facebookId: profile.id,
        avatarUrl: profile.photos[0].value,
        isActive: true,
        isEmployee: false,
      }).catch((error) => {
        console.error('Facebook newUser | error: ', error);
        return done(error);
      });

      if (typeof newUser !== 'undefined') done(null, newUser);
    } else {
      const error = Error('profile.id wasn`t found');
      error.code = 'FB_AUTH_FAILED';
      done(error);
    }
  } else { // user already exists
    return done(null, userResult);
  }
};

// generate code to reset password
const generateRandomCode = async (bottomRangeLimit, upperRangeLimit) => {
  const code = Math.floor(Math.random() * (upperRangeLimit - bottomRangeLimit) + bottomRangeLimit);
  return code;
};

// confirmationToken as JSON Web Encryption(JWE) using AES encryption
const generateEmailConfirmationToken = async (userId) => {
  const jwk = await JWK.asKey(DEV_JWK).catch((error) => {
    throw error;
  });
  const payload = JSON.stringify({
    id: userId,
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 2), // 2 hours
  });

  const options = {
    format: 'compact',
  };
  const token = await JWE.createEncrypt(options, jwk).update(payload).final().catch((error) => {
    throw error;
  });

  return token;
};

const decodeEmailConfirmationToken = async (confirmationToken) => {
  const key = await JWK.asKey(DEV_JWK);
  const decrypted = await JWE.createDecrypt(key)
    .decrypt(confirmationToken)
    .catch((error) => {
      switch (error.message) {
        case 'Algorithm not allowed: undefined': {
          error.code = 'ALGORITHM_NOT_ALLOWED';
          break;
        }
        default: {
          error.code = 'JWE_DEFAULT_ERROR';
        }
      }
      throw error;
    });

  try {
    const payload = JSON.parse(decrypted.payload);
    const now = new Date().getTime();
    if (payload && payload.exp && payload.exp >= Math.floor(now / 1000)) {
      return payload;
    }
    const error = new Error('Token is expired');
    error.code = 'TOKEN_EXPIRED_ERROR';
    throw error;
  } catch (error) {
    throw error;
  }
};

const sendEmailConfirmationToken = async (generatedToken, receiverEmail) => {
  const transporter = nodemailer.createTransport(smtpTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    auth: {
      user: GMAIL_ADDRESS,
      pass: EMAIL_PASSWORD,
    },
  }));

  const mailOptions = {
    from: GMAIL_ADDRESS, // sender address
    to: receiverEmail, // list of receivers
    subject: 'Email Confirmation', // Subject line
    html: `<p>Please, Confirm your email:</p><a href="${process.env.API_HOST}:${process.env.PORT}/public/auth/confirm-email/?token=${generatedToken}">Confirm</a>`,
  };

  const sendingDetails = await transporter.sendMail(mailOptions).catch((error) => {
    console.error(`Error during email sending: ${error}`);
    switch (error.code) {
      default: {
        throw error;
      }
    }
  });
  if (typeof sendingDetails === 'undefined') return undefined;
  return sendingDetails;
};

const sendResetPasswordCode = async (generatedCode, receiverEmail) => {
  const transporter = nodemailer.createTransport(smtpTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    auth: {
      user: GMAIL_ADDRESS,
      pass: EMAIL_PASSWORD,
    },
  }));

  const mailOptions = {
    from: GMAIL_ADDRESS, // sender address
    to: receiverEmail, // list of receivers
    subject: 'Reset password', // Subject line
    html: `<p>Code to change password: </p>${generatedCode}`,
  };

  const sendingDetails = await transporter.sendMail(mailOptions).catch((error) => {
    console.error(`Error during email sending: ${error}`);
    switch (error.code) {
      default: {
        throw error;
      }
    }
  });
  if (typeof sendingDetails === 'undefined') return undefined;
  return sendingDetails;
};

const savePasswordResetCode = async (code, email) => {
  const passwordResetCodeInfo = { code };
  // it rewrites if any value with the same key has already exist
  const redisResult = await redisClient.setexAsync(`${email}`, 60 * 5, JSON.stringify(passwordResetCodeInfo)).catch((error) => {
    throw error;
  }); // expires in 5 minutes
  if (typeof redisResult === 'undefined') return;
  // eslint-disable-next-line consistent-return
  return { success: true };
};

const getPasswordResetCodeByEmail = async (email) => {
  // return code as string type
  const cachedCode = await redisClient.getAsync(`${email}`).catch((error) => {
    throw error;
  });
  if (typeof cachedCode === 'undefined') return;

  if (cachedCode) {
    try {
      const cachedCodeJson = JSON.parse(cachedCode);
      // eslint-disable-next-line consistent-return
      return cachedCodeJson.code;
    } catch (error) {
      throw error;
    }
  } else {
    const error = Error(`reset password code is not found for this email: ${email}`);
    error.code = 'CODE_NOT_FOUND';
    throw error;
  }
};


module.exports = {
  generateEmailConfirmationToken,
  decodeEmailConfirmationToken,
  facebookAuthStrategyHandler,
  getPasswordResetCodeByEmail,
  sendEmailConfirmationToken,
  googleAuthStrategyHandler,
  sendResetPasswordCode,
  savePasswordResetCode,
  generateRandomCode,
};
