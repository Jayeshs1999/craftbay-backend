import express from "express";
import passport from "passport";
import {
  registerUser, loginUser, logoutUser, getMe,
  becomeSeller, updateProfile, addAddress, deleteAddress,
} from "../controllers/authController.js";
import { googleCallback } from "../controllers/googleAuthController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register",        registerUser);
router.post("/login",           loginUser);
router.post("/logout",          protect, logoutUser);
router.get("/me",               protect, getMe);
router.put("/become-seller",    protect, becomeSeller);
router.put("/profile",          protect, updateProfile);
router.post("/address",         protect, addAddress);
router.delete("/address/:id",   protect, deleteAddress);

// Guard: return 503 when Google credentials are not configured
function requireGoogleConfig(req, res, next) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({
      message: "Google OAuth is not configured on this server. " +
               "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your .env file.",
    });
  }
  next();
}

// Google OAuth
router.get(
  "/google",
  requireGoogleConfig,
  passport.authenticate("google", { scope: ["profile", "email"], session: false })
);

router.get(
  "/google/callback",
  requireGoogleConfig,
  passport.authenticate("google", { failureRedirect: "/login", session: false }),
  googleCallback
);

export default router;
