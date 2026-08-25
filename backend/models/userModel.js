import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const addressSchema = new mongoose.Schema(
  {
    label:    { type: String, default: "Home" },
    fullName: { type: String, required: true },
    phone:    { type: String, required: true },
    line1:    { type: String, required: true },
    line2:    { type: String },
    city:     { type: String, required: true },
    state:    { type: String, required: true },
    pincode:  { type: String, required: true },
    country:  { type: String, default: "India" },
    isDefault:{ type: Boolean, default: false },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name:       { type: String, required: true, trim: true },
    email:      { type: String, required: true, unique: true, lowercase: true },
    phone:      { type: String, unique: true, sparse: true },
    googleId:   { type: String, unique: true, sparse: true },
    password:   { type: String },
    avatar:     { type: String, default: "" },
    role:       { type: String, enum: ["buyer", "seller", "admin"], default: "buyer" },
    isSeller:   { type: Boolean, default: false },

    // Seller profile (populated when isSeller=true)
    sellerProfile: {
      shopName:    { type: String },
      shopDesc:    { type: String },
      shopBanner:  { type: String },
      shopCity:    { type: String },
      shopState:   { type: String },
      pickupPincode: { type: String },
      rating:      { type: Number, default: 0 },
      totalSales:  { type: Number, default: 0 },
      isVerified:  { type: Boolean, default: false },
    },

    addresses:   [addressSchema],
    wishlist:    [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Hash password before save (only when password is set/changed)
userSchema.pre("save", async function (next) {
  if (!this.password || !this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  if (!this.password) return false;
  return bcrypt.compare(entered, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
