import jwt from "jsonwebtoken";

// API token verification for the MCP endpoint.
//
// Backed by the same jsonwebtoken package and usage pattern as
// subsquare-backend (jwt.sign / jwt.verify over an HS256 secret, with `exp`
// enforced by the library), so both sides stay interchangeable. The MCP server
// only decodes — it never signs — tokens that subsquare-backend issues with a
// DEDICATED key for MCP (see MCP_API_JWT_SECRET_KEY in config/rateLimit.js),
// separate from the backend's own user-session JWT_SECRET_KEY. The secret here
// must match the key the backend signs these MCP tokens with.
//
// Verified tokens must carry:
//   sub   string user ID, used as the rate limit bucket key (required)
//   exp   numeric expiry (seconds), set by jsonwebtoken via expiresIn and
//         enforced on verify; required here as the hard safety floor
//   jti   optional unique token ID (reserved for future revocation)
//   quota optional rate limit plan name; falls back to the default plan

function invalidTokenError(message = "Invalid token") {
  const error = new Error(message);
  error.code = "INVALID_TOKEN";
  return error;
}

// Verifies an HS256 JWT against `secret` and returns its decoded payload.
// Throws an Error whose `code` is "INVALID_TOKEN" for a malformed, wrongly
// signed, or structurally-invalid token, and "TOKEN_EXPIRED" when jsonwebtoken
// reports the token's exp claim is in the past.
export function verifyJwtToken(token, secret) {
  let payload;
  try {
    payload = jwt.verify(token, secret);
  } catch (error) {
    if (error && error.name === "TokenExpiredError") {
      const expiredError = new Error("Token expired");
      expiredError.code = "TOKEN_EXPIRED";
      throw expiredError;
    }
    throw invalidTokenError();
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw invalidTokenError();
  }
  if (typeof payload.sub !== "string" || payload.sub === "") {
    throw invalidTokenError("Token is missing a sub claim");
  }
  // exp is the hard safety floor: jsonwebtoken only enforces it when present,
  // so require it explicitly to guarantee every token expires.
  if (typeof payload.exp !== "number") {
    throw invalidTokenError("Token is missing an exp claim");
  }

  return payload;
}
