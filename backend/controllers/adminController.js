import asyncHandler from "../middleware/asyncHandler.js";
import Order from "../models/orderModel.js";
import Product from "../models/productModel.js";
import User from "../models/userModel.js";
import { sendMail } from "../utils/mailer.js";
import {
  adminNudgeSellerEmail,
  sellerNoProductsEmail,
  sellerOneProductEmail,
  sellerKeepGoingEmail,
  sellerShareShopEmail,
  sellerTipsEmail,
  buyerBecomeSellerIntroEmail,
  buyerBecomeSellerNudgeEmail,
  buyerSellerBenefitsEmail,
} from "../utils/emailTemplates.js";

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

// ─── GET /api/admin/sellers ───────────────────────────────────────────────
// @desc  Admin: list sellers with product count (for mail panel)
// @route GET /api/admin/sellers?filter=no_products|one_product|all
// @access Private/Admin
export const adminGetSellers = asyncHandler(async (req, res) => {
  const { filter = "all" } = req.query;

  const sellers = await User.find({ isSeller: true })
    .select("name email sellerProfile createdAt")
    .sort({ createdAt: -1 })
    .lean();

  // Attach product count to each seller
  const sellerIds = sellers.map((s) => s._id);
  const productCounts = await Product.aggregate([
    { $match: { seller: { $in: sellerIds } } },
    { $group: { _id: "$seller", count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(productCounts.map((p) => [p._id.toString(), p.count]));

  let result = sellers.map((s) => ({
    ...s,
    productCount: countMap[s._id.toString()] || 0,
  }));

  if (filter === "no_products")  result = result.filter((s) => s.productCount === 0);
  if (filter === "one_product")  result = result.filter((s) => s.productCount === 1);

  res.json({ sellers: result, total: result.length });
});

// ─── POST /api/admin/mail-sellers ─────────────────────────────────────────
// @desc  Admin: send a chosen email type to one or more sellers
// @route POST /api/admin/mail-sellers
// @body  { sellerIds: string[], mailType: "no_products"|"one_product"|"keep_going"|"share_shop"|"tips", customNote?: string }
// @access Private/Admin
export const adminMailSellers = asyncHandler(async (req, res) => {
  const { sellerIds, mailType, customNote } = req.body;

  if (!sellerIds?.length) {
    res.status(400); throw new Error("No sellers selected");
  }
  if (!mailType) {
    res.status(400); throw new Error("mailType is required");
  }

  const MAIL_TYPES = ["no_products", "one_product", "keep_going", "share_shop", "tips"];
  if (!MAIL_TYPES.includes(mailType)) {
    res.status(400); throw new Error(`Invalid mailType. Must be one of: ${MAIL_TYPES.join(", ")}`);
  }

  const sellers = await User.find({ _id: { $in: sellerIds }, isSeller: true })
    .select("name email sellerProfile")
    .lean();

  const templateFn = {
    no_products:  sellerNoProductsEmail,
    one_product:  sellerOneProductEmail,
    keep_going:   sellerKeepGoingEmail,
    share_shop:   sellerShareShopEmail,
    tips:         sellerTipsEmail,
  }[mailType];

  const sent = [];
  const failed = [];

  for (const seller of sellers) {
    if (!seller.email) { failed.push({ id: seller._id, reason: "no email" }); continue; }
    const shopName = seller.sellerProfile?.shopName || seller.name;
    try {
      const { subject, html } = templateFn({ name: seller.name, shopName });
      const finalHtml = customNote
        ? html.replace(
            "</table>\n</body>",
            `<tr><td style="padding:16px 32px 24px;background:#fff7ed;border-top:1px solid #fed7aa;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#9a3412;text-transform:uppercase;">Personal note from Banavoo</p>
              <p style="margin:0;font-size:14px;color:#374151;">${customNote}</p>
            </td></tr></table>\n</body>`
          )
        : html;
      await sendMail({ to: seller.email, subject, html: finalHtml });
      sent.push({ id: seller._id, name: seller.name, email: seller.email });
    } catch (err) {
      failed.push({ id: seller._id, name: seller.name, reason: err.message });
    }
  }

  res.json({ sent, failed, total: sent.length });
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

// ─── GET /api/admin/buyers ────────────────────────────────────────────────
// @desc  Admin: list buyers (non-sellers) for outreach mail panel
// @route GET /api/admin/buyers?filter=all|no_orders|has_orders
// @access Private/Admin
export const adminGetBuyers = asyncHandler(async (req, res) => {
  const { filter = "all" } = req.query;

  // Buyers = users who are NOT sellers
  const buyers = await User.find({ isSeller: false, role: { $ne: "admin" } })
    .select("name email createdAt")
    .sort({ createdAt: -1 })
    .lean();

  const buyerIds = buyers.map((b) => b._id);

  // Count orders per buyer
  const orderCounts = await Order.aggregate([
    { $match: { buyer: { $in: buyerIds } } },
    { $group: { _id: "$buyer", count: { $sum: 1 } } },
  ]);
  const orderMap = Object.fromEntries(orderCounts.map((o) => [o._id.toString(), o.count]));

  let result = buyers.map((b) => ({
    ...b,
    orderCount: orderMap[b._id.toString()] || 0,
  }));

  if (filter === "no_orders")  result = result.filter((b) => b.orderCount === 0);
  if (filter === "has_orders") result = result.filter((b) => b.orderCount > 0);

  res.json({ buyers: result, total: result.length });
});

// ─── POST /api/admin/mail-buyers ──────────────────────────────────────────
// @desc  Admin: send a "become a seller" email type to selected buyers
// @route POST /api/admin/mail-buyers
// @body  { buyerIds: string[], mailType: "become_seller_intro"|"become_seller_nudge"|"seller_benefits", customNote?: string }
// @access Private/Admin
export const adminMailBuyers = asyncHandler(async (req, res) => {
  const { buyerIds, mailType, customNote } = req.body;

  if (!buyerIds?.length) {
    res.status(400); throw new Error("No buyers selected");
  }

  const BUYER_MAIL_TYPES = ["become_seller_intro", "become_seller_nudge", "seller_benefits"];
  if (!mailType || !BUYER_MAIL_TYPES.includes(mailType)) {
    res.status(400); throw new Error(`Invalid mailType. Must be one of: ${BUYER_MAIL_TYPES.join(", ")}`);
  }

  const buyers = await User.find({ _id: { $in: buyerIds }, isSeller: false })
    .select("name email")
    .lean();

  const templateFn = {
    become_seller_intro:  buyerBecomeSellerIntroEmail,
    become_seller_nudge:  buyerBecomeSellerNudgeEmail,
    seller_benefits:      buyerSellerBenefitsEmail,
  }[mailType];

  const sent = [];
  const failed = [];

  for (const buyer of buyers) {
    if (!buyer.email) { failed.push({ id: buyer._id, reason: "no email" }); continue; }
    try {
      const { subject, html } = templateFn({ name: buyer.name });
      const finalHtml = customNote
        ? html.replace(
            "</table>\n</body>",
            `<tr><td style="padding:16px 32px 24px;background:#f0fdf4;border-top:1px solid #bbf7d0;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#065f46;text-transform:uppercase;">Personal note from Banavoo</p>
              <p style="margin:0;font-size:14px;color:#374151;">${customNote}</p>
            </td></tr></table>\n</body>`
          )
        : html;
      await sendMail({ to: buyer.email, subject, html: finalHtml });
      sent.push({ id: buyer._id, name: buyer.name, email: buyer.email });
    } catch (err) {
      failed.push({ id: buyer._id, name: buyer.name, reason: err.message });
    }
  }

  res.json({ sent, failed, total: sent.length });
});
