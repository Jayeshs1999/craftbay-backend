import jwt from "jsonwebtoken";

// Generates and sets the JWT as an httpOnly cookie.
// Use this for same-origin flows (email/password login, register).
const generateToken = (res, userId) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });

  const isProd = process.env.NODE_ENV === "production";

  res.cookie("jwt", token, {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? "none" : "strict",
    maxAge:   30 * 24 * 60 * 60 * 1000,
  });
};

// Generates just the signed token string without touching the response.
// Use this for OAuth flows where the token must travel via URL param
// (cross-origin redirects cannot carry Set-Cookie headers reliably).
export const generateTokenString = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

export default generateToken;
