const crypto = require("crypto");
const argon2 = require('argon2')
exports.genRandToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

exports.hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

exports.hashPassword = (password) => {
  return argon2.hash(password, {
    type: argon2.argon2id,
  });
};
