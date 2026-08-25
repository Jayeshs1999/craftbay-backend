import jwt from "jsonwebtoken";

const generateToken = (res, userId) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });

  const isProd = process.env.NODE_ENV === "production";

  res.cookie("jwt", token, {
    httpOnly: true,
    secure:   isProd,
    // "strict" blocks the cookie on cross-origin redirects (e.g. Google OAuth
    // callback → backend → frontend redirect). Use "none" in production so the
    // cookie is included when the browser follows the redirect to the frontend.
    sameSite: isProd ? "none" : "strict",
    maxAge:   30 * 24 * 60 * 60 * 1000,
  });
};

export default generateToken;
