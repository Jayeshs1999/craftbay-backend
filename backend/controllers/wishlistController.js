import asyncHandler from "../middleware/asyncHandler.js";
import User from "../models/userModel.js";
import Product from "../models/productModel.js";

// @desc  Get wishlist
// @route GET /api/wishlist
// @access Private
export const getWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate("wishlist", "name price images rating numReviews isActive");
  res.json(user.wishlist.filter((p) => p.isActive));
});

// @desc  Toggle wishlist item
// @route POST /api/wishlist/:productId
// @access Private
export const toggleWishlist = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const pid  = req.params.productId;

  const idx = user.wishlist.findIndex((id) => id.toString() === pid);
  if (idx === -1) {
    user.wishlist.push(pid);
    await user.save();
    return res.json({ added: true, wishlist: user.wishlist });
  }
  user.wishlist.splice(idx, 1);
  await user.save();
  res.json({ added: false, wishlist: user.wishlist });
});
