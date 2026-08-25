import jwt from "jsonwebtoken";

// Called after Passport successfully authenticates with Google.
// Redirects to the frontend /auth/callback page with the JWT as a query param.
// The frontend stores it in Zustand and uses it as a Bearer token — this
// avoids all cross-origin cookie issues entirely.
export const googleCallback = (req, res) => {
  const user       = req.user;
  const frontendURL = process.env.FRONTEND_URL || "http://localhost:3000";

  const token = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );

  res.redirect(`${frontendURL}/auth/callback?token=${token}`);
};
