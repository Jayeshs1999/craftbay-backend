import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/userModel.js";

// Only register the strategy when credentials are present.
// Without this guard the server crashes at boot if GOOGLE_CLIENT_ID is not set.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:  process.env.GOOGLE_CALLBACK_URL ||
                      "http://localhost:5000/api/auth/google/callback",
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email  = profile.emails?.[0]?.value?.toLowerCase();
          const avatar = profile.photos?.[0]?.value || "";

          // Find by googleId first, then fall back to email
          let user = await User.findOne({ googleId: profile.id });

          if (!user && email) {
            user = await User.findOne({ email });
          }

          if (user) {
            // Link googleId if not already linked
            if (!user.googleId) {
              user.googleId = profile.id;
              if (!user.avatar && avatar) user.avatar = avatar;
              await user.save();
            }
            return done(null, user);
          }

          // Create new user
          user = await User.create({
            googleId: profile.id,
            name:     profile.displayName,
            email,
            avatar,
          });

          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );
} else {
  console.warn(
    "[passport] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — " +
    "Google OAuth routes will return 503 until credentials are configured."
  );
}

export default passport;
