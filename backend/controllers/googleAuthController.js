import { generateTokenString } from "../utils/generateToken.js";

// Called after Passport successfully authenticates with Google.
// We cannot set an httpOnly cookie and redirect cross-origin reliably —
// the browser drops Set-Cookie headers on cross-domain redirects.
// Instead, pass a short-lived token in the URL; the frontend /auth/callback
// page exchanges it for a proper httpOnly cookie via a same-origin POST.
export const googleCallback = (req, res) => {
  const user = req.user;
  const frontendURL = process.env.FRONTEND_URL || "http://localhost:3000";

  const token = generateTokenString(user._id);

  res.redirect(`${frontendURL}/auth/callback?token=${token}`);
};
