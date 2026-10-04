const crypto = require('crypto');

// 8 hex characters, e.g. "A1B2C3D4"
function generateJoinCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

module.exports = { generateJoinCode };
