import generateToken from "../utils/generateToken.js";

// Called after Passport successfully authenticates with Google.
// Sets the JWT cookie and redirects back to the frontend.
export const googleCallback = (req, res) => {
  const user = req.user;

  // Read at request time so the env var is always resolved,
  // even if the module was first evaluated before dotenv ran.
  const frontendURL = process.env.FRONTEND_URL || "http://localhost:3000";

  generateToken(res, user._id);

  // Redirect to the appropriate dashboard
  const dest = user.isSeller ? "/seller" : "/dashboard";
  res.redirect(`${frontendURL}${dest}`);
};
