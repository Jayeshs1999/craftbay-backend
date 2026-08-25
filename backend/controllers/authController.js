import jwt from "jsonwebtoken";
import asyncHandler from "../middleware/asyncHandler.js";
import User from "../models/userModel.js";
import generateToken from "../utils/generateToken.js";

// @desc  Register a new user
// @route POST /api/auth/register
// @access Public
export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Please provide name, email and password");
  }

  const exists = await User.findOne({ email });
  if (exists) {
    res.status(400);
    throw new Error("Email already registered");
  }

  const user = await User.create({ name, email, password, phone });
  generateToken(res, user._id, "user");

  res.status(201).json({
    _id:     user._id,
    name:    user.name,
    email:   user.email,
    role:    user.role,
    isSeller: user.isSeller,
  });
});

// @desc  Login user
// @route POST /api/auth/login
// @access Public
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error("Invalid email or password");
  }
  if (!user.isActive) {
    res.status(403);
    throw new Error("Account suspended");
  }

  generateToken(res, user._id, "user");

  res.json({
    _id:     user._id,
    name:    user.name,
    email:   user.email,
    phone:   user.phone,
    avatar:  user.avatar,
    role:    user.role,
    isSeller: user.isSeller,
    sellerProfile: user.sellerProfile,
  });
});

// @desc  Logout user (clear cookie)
// @route POST /api/auth/logout
// @access Private
export const logoutUser = asyncHandler(async (req, res) => {
  res.cookie("jwt", "", { httpOnly: true, expires: new Date(0) });
  res.json({ message: "Logged out" });
});

// @desc  Get current user profile
// @route GET /api/auth/me
// @access Private
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");
  if (!user) { res.status(404); throw new Error("User not found"); }
  res.json(user);
});

// @desc  Become a seller (upgrade role)
// @route PUT /api/auth/become-seller
// @access Private
export const becomeSeller = asyncHandler(async (req, res) => {
  const { shopName, shopDesc, shopCity, shopState, pickupPincode } = req.body;

  if (!shopName || !shopCity || !shopState || !pickupPincode) {
    res.status(400);
    throw new Error("Shop name, city, state and pincode are required");
  }

  const user = await User.findById(req.user._id);
  user.isSeller = true;
  user.role     = "seller";
  user.sellerProfile = { shopName, shopDesc, shopCity, shopState, pickupPincode };
  await user.save();

  res.json({ message: "Seller account activated", sellerProfile: user.sellerProfile });
});

// @desc  Update profile / addresses
// @route PUT /api/auth/profile
// @access Private
export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) { res.status(404); throw new Error("User not found"); }

  const { name, phone, avatar } = req.body;
  if (name)   user.name   = name;
  if (phone)  user.phone  = phone;
  if (avatar) user.avatar = avatar;

  if (req.body.password) {
    user.password = req.body.password;
  }

  const updated = await user.save();
  res.json({ _id: updated._id, name: updated.name, email: updated.email, phone: updated.phone, avatar: updated.avatar });
});

// @desc  Add / update a delivery address
// @route POST /api/auth/address
// @access Private
export const addAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const { label, fullName, phone, line1, line2, city, state, pincode, isDefault } = req.body;

  if (isDefault) {
    user.addresses.forEach((a) => (a.isDefault = false));
  }
  user.addresses.push({ label, fullName, phone, line1, line2, city, state, pincode, isDefault });
  await user.save();
  res.status(201).json(user.addresses);
});

// @desc  Delete a delivery address
// @route DELETE /api/auth/address/:id
// @access Private
export const deleteAddress = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.addresses = user.addresses.filter((a) => a._id.toString() !== req.params.id);
  await user.save();
  res.json(user.addresses);
});

// @desc  Exchange a URL token (from Google OAuth redirect) for an httpOnly cookie
// @route POST /api/auth/verify-token
// @access Public
export const verifyToken = asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    res.status(400);
    throw new Error("Token is required");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    res.status(401);
    throw new Error("Invalid or expired token");
  }

  const user = await User.findById(decoded.userId).select("-password");
  if (!user || !user.isActive) {
    res.status(401);
    throw new Error("User not found");
  }

  // Issue a fresh httpOnly cookie (same-origin — this request comes from
  // the frontend domain, so the cookie will be stored correctly).
  generateToken(res, user._id);

  res.json({
    _id:      user._id,
    name:     user.name,
    email:    user.email,
    phone:    user.phone,
    avatar:   user.avatar,
    role:     user.role,
    isSeller: user.isSeller,
    sellerProfile: user.sellerProfile,
  });
});
