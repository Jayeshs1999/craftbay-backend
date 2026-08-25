import jwt from "jsonwebtoken";
import asyncHandler from "./asyncHandler.js";
import User from "../models/userModel.js";

export const protect = asyncHandler(async (req, res, next) => {
  const token = req.cookies.jwt || req.header("Authorization")?.replace("Bearer ", "");
  if (!token) { res.status(401); throw new Error("Not authorized, no token"); }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.userId).select("-password");
    if (!req.user) { res.status(401); throw new Error("User not found"); }
    next();
  } catch {
    res.status(401);
    throw new Error("Not authorized, token failed");
  }
});

export const requireSeller = asyncHandler(async (req, res, next) => {
  if (req.user && req.user.isSeller) return next();
  res.status(403);
  throw new Error("Seller account required");
});

export const requireAdmin = asyncHandler(async (req, res, next) => {
  if (req.user && req.user.role === "admin") return next();
  res.status(403);
  throw new Error("Admin access required");
});
