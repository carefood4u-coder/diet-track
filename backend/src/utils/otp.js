const bcrypt = require('bcryptjs');

/** Generates a random 6-digit numeric OTP as a string, e.g. "042817". */
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function hashOtp(otp) {
  return bcrypt.hash(otp, 10);
}

async function compareOtp(otp, otpHash) {
  return bcrypt.compare(otp, otpHash);
}

module.exports = { generateOtp, hashOtp, compareOtp };
