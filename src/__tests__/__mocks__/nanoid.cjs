// CJS stub for ESM-only nanoid — returns predictable slug in tests
const { randomBytes } = require("crypto");
module.exports = {
  nanoid: (size = 21) => randomBytes(size).toString("hex").slice(0, size),
};
