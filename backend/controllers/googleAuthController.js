import generateToken from "../utils/generateToken.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Called after Passport successfully authenticates with Google.
// Sets the JWT cookie and redirects back to the frontend.
export const googleCallback = (req, res) => {
  const user = req.user;

  generateToken(res, user._id);

  // Redirect to the appropriate dashboard
  const dest = user.isSeller ? "/seller" : "/dashboard";
  res.redirect(`${FRONTEND_URL}${dest}`);
};
