// CJS stub for ESM-only jose — delegates to the real implementation via dynamic require
// We use the actual jose by loading it with require() after patching
// For tests that need real JWT behaviour, session.ts is mocked at the jest.mock level.
// This stub exists only so that imports of "jose" inside session.ts don't explode
// when the session module itself is NOT mocked.

const crypto = require("crypto");

class SignJWT {
  constructor(payload) {
    this._payload = payload;
  }
  setProtectedHeader() { return this; }
  setExpirationTime() { return this; }
  async sign(secret) {
    const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(this._payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
    return `${header}.${body}.${sig}`;
  }
}

async function jwtVerify(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT");
  const [header, body, sig] = parts;
  const expected = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  if (sig !== expected) throw new Error("Signature mismatch");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString());
  if (payload.exp && Date.now() / 1000 > payload.exp) throw new Error("Token expired");
  return { payload };
}

module.exports = { SignJWT, jwtVerify };
