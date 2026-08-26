import dotenv from "dotenv";
dotenv.config();

// NOTE: All subsequent imports must come AFTER dotenv.config() has run.
// In ESM, static imports are hoisted, so dotenv must be the very first module
// evaluated. We achieve this by putting dotenv in its own entry shim, or by
// using a dynamic import. Here we use a dynamic import wrapper so that
// passport (which reads GOOGLE_CLIENT_ID at evaluation time) only loads after
// the env vars are populated.

const { default: express }       = await import("express");
const { default: cors }          = await import("cors");
const { default: cookieParser }  = await import("cookie-parser");
const { default: connectDB }     = await import("./config/db.js");
const { errorHandler, notFound } = await import("./middleware/errorMiddleware.js");
await import("./config/passport.js");   // registers the Google strategy
const { default: authRoutes }     = await import("./routes/authRoutes.js");
const { default: productRoutes }  = await import("./routes/productRoutes.js");
const { default: orderRoutes }    = await import("./routes/orderRoutes.js");
const { default: deliveryRoutes } = await import("./routes/deliveryRoutes.js");
const { default: wishlistRoutes } = await import("./routes/wishlistRoutes.js");

const port = process.env.PORT || 5000;

connectDB();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(cors({
  origin: [
    "http://localhost:3000",
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.get("/", (req, res) => res.send("Banavoo.in API is running"));

app.use("/api/auth",     authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders",   orderRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/wishlist", wishlistRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(port, () => console.log(`Server running on port ${port}`));
