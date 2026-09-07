import asyncHandler from "../middleware/asyncHandler.js";
import Order from "../models/orderModel.js";
import Product from "../models/productModel.js";
import User from "../models/userModel.js";
import { sendMail } from "../utils/mailer.js";
import { adminNudgeSellerEmail } from "../utils/emailTemplates.js";

// ─── GET /api/admin/orders ─────────────────────────────────────────────────
// @desc  Admin: list all orders with buyer + seller details, filterable
// @route GET /api/admin/orders?status=&sellerId=&buyerId=&page=&limit=
// @access Private/Admin
export const adminGetAllOrders = asyncHandler(async (req, res) => {
  const page   = Number(req.query.page)  || 1;
  const limit  = Number(req.query.limit) || 20;
  const filter = {};

  if (req.query.status)   filter.orderStatus       = req.query.status;
  if (req.query.sellerId) filter["items.seller"]   = req.query.sellerId;
  if (req.query.buyerId)  filter.buyer             = req.query.buyerId;

  // "unresponded" = orders still pending/confirmed after X hours with no seller action
  if (req.query.unresponded === "true") {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 h ago
    filter.orderStatus = { $in: ["pending", "confirmed"] };
    filter.createdAt   = { $lte: cutoff };
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("buyer", "name email phone")
      .populate("items.seller", "name email phone sellerProfile"),
    Order.countDocuments(filter),
  ]);

  res.json({ orders, page, pages: Math.ceil(total / limit), total });
});

// ─── GET /api/admin/orders/:id ─────────────────────────────────────────────
// @desc  Admin: full order detail
// @route GET /api/admin/orders/:id
// @access Private/Admin
export const adminGetOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("buyer", "name email phone addresses")
    .populate("items.product", "name images price")
    .populate("items.seller", "name email phone sellerProfile");

  if (!order) { res.status(404); throw new Error("Order not found"); }
  res.json(order);
});

// ─── GET /api/admin/stats ──────────────────────────────────────────────────
// @desc  Admin: platform-wide stats (orders, revenue, users, sellers)
// @route GET /api/admin/stats
// @access Private/Admin
export const adminGetStats = asyncHandler(async (req, res) => {
  const [
    totalOrders,
    pendingOrders,
    unrespondedOrders,
    deliveredOrders,
    cancelledOrders,
    totalRevenue,
    totalUsers,
    totalSellers,
    totalProducts,
  ] = await Promise.all([
    Order.countDocuments(),
    Order.countDocuments({ orderStatus: { $in: ["pending", "confirmed"] } }),
    Order.countDocuments({
      orderStatus: { $in: ["pending", "confirmed"] },
      createdAt:   { $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }),
    Order.countDocuments({ orderStatus: "delivered" }),
    Order.countDocuments({ orderStatus: "cancelled" }),
    Order.aggregate([
      { $match: { orderStatus: { $nin: ["cancelled", "returned"] } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
    User.countDocuments(),
    User.countDocuments({ isSeller: true }),
    Product.countDocuments({ isActive: true }),
  ]);

  res.json({
    totalOrders,
    pendingOrders,
    unrespondedOrders,
    deliveredOrders,
    cancelledOrders,
    totalRevenue: totalRevenue[0]?.total || 0,
    totalUsers,
    totalSellers,
    totalProducts,
  });
});

// ─── POST /api/admin/orders/:id/nudge-seller ──────────────────────────────
// @desc  Admin: send a reminder email/note to seller for a specific order
// @route POST /api/admin/orders/:id/nudge-seller
// @access Private/Admin
export const adminNudgeSeller = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("buyer", "name email phone")
    .populate("items.seller", "name email phone sellerProfile");

  if (!order) { res.status(404); throw new Error("Order not found"); }

  const { note = "" } = req.body;

  // Collect unique sellers on this order
  const sellersSeen = new Set();
  const nudgedSellers = [];

  for (const item of order.items) {
    const seller = item.seller;
    if (!seller || sellersSeen.has(seller._id.toString())) continue;
    sellersSeen.add(seller._id.toString());

    if (seller.email) {
      const { subject, html } = adminNudgeSellerEmail({
        sellerName: seller.name,
        shopName:   seller.sellerProfile?.shopName || seller.name,
        order:      order.toObject(),
        adminNote:  note,
      });
      sendMail({ to: seller.email, subject, html });
      nudgedSellers.push({ id: seller._id, name: seller.name, email: seller.email });
    }
  }

  // Log the nudge in order status history
  order.statusHistory.push({
    status:    order.orderStatus,
    note:      `Admin nudged seller${note ? ": " + note : ""}`,
    updatedBy: "admin",
  });
  await order.save();

  res.json({ message: "Nudge sent", nudgedSellers });
});

// ─── GET /api/admin/users ──────────────────────────────────────────────────
// @desc  Admin: list all users (buyers + sellers)
// @route GET /api/admin/users?role=&page=&limit=
// @access Private/Admin
export const adminGetUsers = asyncHandler(async (req, res) => {
  const page  = Number(req.query.page)  || 1;
  const limit = Number(req.query.limit) || 30;
  const filter = {};
  if (req.query.role === "seller") filter.isSeller = true;
  if (req.query.role === "buyer")  { filter.isSeller = false; filter.role = "buyer"; }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ users, page, pages: Math.ceil(total / limit), total });
});

// ─── PUT /api/admin/orders/:id/status ─────────────────────────────────────
// @desc  Admin: force-update any order status (override)
// @route PUT /api/admin/orders/:id/status
// @access Private/Admin
export const adminUpdateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error("Order not found"); }

  order.orderStatus = status;
  order.statusHistory.push({ status, note: note || "Admin override", updatedBy: "admin" });
  if (status === "delivered") order.paymentStatus = "paid";

  await order.save();
  res.json(order);
});
