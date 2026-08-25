import jwt from "jsonwebtoken";

const generateToken = (res, userId) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });

  const isProd = process.env.NODE_ENV === "production";

  // Set httpOnly cookie (works for same-origin / local dev)
  res.cookie("jwt", token, {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? "none" : "strict",
    maxAge:   30 * 24 * 60 * 60 * 1000,
  });

  // Return the token string so callers can include it in the JSON response
  // for clients that use Bearer auth (cross-origin / deployed setups).
  return token;
};

export default generateToken;
