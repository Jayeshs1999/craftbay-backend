import express from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import { protect, requireSeller, requireAdmin, optionalAuth } from "../middleware/authMiddleware.js";
import { uploadCustomRequestImages } from "../config/cloudinary.js";
import CustomRequest from "../models/customRequestModel.js";
import User from "../models/userModel.js";
import { sendMail } from "../utils/mailer.js";
import {
  customRequestPostedToSeller,
  newBidReceivedToBuyer,
  bidAcceptedToSeller,
  bidRejectedToSeller,
  requestClosedToOtherSellers,
  requestCancelledToSeller,
} from "../utils/customRequestEmails.js";

const router = express.Router();

// ─── EMAIL MODE ───────────────────────────────────────────────────────────────
// DEMO / TESTING  → uncomment the TEST_EMAIL line and comment out the line below it
// PRODUCTION      → keep TEST_EMAIL commented, actual recipient emails are used
//
// const TEST_EMAIL = "jayeshsevatkar55@gmail.com";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Notify all active sellers about a new custom request. */
async function notifySellersNewRequest(creq, buyerName) {
  const sellers = await User.find({ isSeller: true, isActive: true })
    .select("name email sellerProfile.shopName")
    .lean();

  for (const seller of sellers) {
    const html = customRequestPostedToSeller({ seller, creq, buyerName });
    await sendMail({
      // to: TEST_EMAIL,   // ← uncomment for demo/testing
      to:  seller.email,   // ← actual seller email
      subject: `🛠️ New Custom Order Request: "${creq.title}" — Banavoo`,
      html,
    });
  }
}

// ─── PUBLIC / BUYER ROUTES ────────────────────────────────────────────────────

// @desc  List all OPEN custom requests (public feed for sellers to browse)
// @route GET /api/custom-requests
// @access Public
router.get(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const page     = Math.max(1, Number(req.query.page)  || 1);
    const limit    = Math.min(50, Number(req.query.limit) || 20);
    const skip     = (page - 1) * limit;
    const category = req.query.category || "";

    // Admin can pass any status; public only sees "open"
    const isAdmin  = req.user?.role === "admin";
    const statusParam = req.query.status;
    const filter   = {};
    if (isAdmin && statusParam && statusParam !== "all") {
      filter.status = statusParam;
    } else if (!isAdmin) {
      filter.status = "open";
    }
    if (category) filter.category = category;

    const [docs, total] = await Promise.all([
      CustomRequest.find(filter)
        .populate("buyer", "name email phone avatar createdAt")
        .populate("bids.seller", "name email sellerProfile.shopName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CustomRequest.countDocuments(filter),
    ]);

    if (!isAdmin) {
      // Never expose accepted-seller contact details in public list
      const safe = docs.map((d) => ({
        ...d,
        bids: d.bids.map((b) => ({ ...b, seller: undefined })),
      }));
      return res.json({ requests: safe, page, pages: Math.ceil(total / limit), total });
    }

    res.json({ requests: docs, page, pages: Math.ceil(total / limit), total });
  })
);

// @desc  Get a single custom request (full detail — bids shown differently based on role)
// @route GET /api/custom-requests/:id
// @access Public (extra detail gated by auth check in handler)
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const creq = await CustomRequest.findById(req.params.id)
      .populate("buyer", "name avatar createdAt")
      .populate("bids.seller", "name sellerProfile.shopName sellerProfile.rating")
      .lean();

    if (!creq) return res.status(404).json({ message: "Request not found" });

    // Increment view count (fire-and-forget)
    CustomRequest.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } }).exec();

    res.json(creq);
  })
);

// @desc  Create a new custom request (buyer)
// @route POST /api/custom-requests
// @access Private (any logged-in user)
router.post(
  "/",
  protect,
  uploadCustomRequestImages,
  asyncHandler(async (req, res) => {
    const { title, description, category, budget, deadline, buyerPhone } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({ message: "title, description and category are required" });
    }
    const phoneDigits = (buyerPhone || "").replace(/\D/g, "");
    if (!phoneDigits) {
      return res.status(400).json({ message: "Your contact number is required so sellers can reach you" });
    }
    if (phoneDigits.length !== 10) {
      return res.status(400).json({ message: "Phone number must be exactly 10 digits" });
    }

    // Build images array from uploaded files (multer-cloudinary) or fallback
    const uploadedImages = (req.files || []).map((f) => ({
      url:      f.path || f.secure_url || "",
      publicId: f.filename || f.public_id || "",
    }));

    const creq = await CustomRequest.create({
      buyer:       req.user._id,
      title:       title.trim(),
      description: description.trim(),
      category:    category.trim(),
      budget:      budget      ? Number(budget)      : null,
      deadline:    deadline    ? new Date(deadline)   : null,
      buyerPhone:  phoneDigits,
      images:      uploadedImages,
    });

    // Notify all sellers (async — don't await so API responds fast)
    notifySellersNewRequest(creq, req.user.name).catch((e) =>
      console.error("[customRequest] notifySellersNewRequest error:", e)
    );

    res.status(201).json(creq);
  })
);

// @desc  Cancel a custom request (buyer, only if open)
// @route PUT /api/custom-requests/:id/cancel
// @access Private (buyer who owns it)
router.put(
  "/:id/cancel",
  protect,
  asyncHandler(async (req, res) => {
    // Populate bids.seller so we can email all sellers who bid
    const creq = await CustomRequest.findById(req.params.id)
      .populate("bids.seller", "name email sellerProfile.shopName");

    if (!creq) return res.status(404).json({ message: "Request not found" });
    if (String(creq.buyer) !== String(req.user._id))
      return res.status(403).json({ message: "Not your request" });
    if (creq.status !== "open")
      return res.status(400).json({ message: `Cannot cancel a request with status '${creq.status}'` });

    creq.status = "cancelled";
    await creq.save();

    // Notify every seller who placed a bid (fire-and-forget)
    const biddingSellers = creq.bids.filter(
      (b) => b.status === "pending" && b.seller?.email
    );
    for (const bid of biddingSellers) {
      const seller = bid.seller;
      // Attach bid price so the template can show it
      const creqWithPrice = { ...creq.toObject(), _bidPrice: bid.price };
      const html = requestCancelledToSeller({ seller, creq: creqWithPrice });
      sendMail({
        // to:      TEST_EMAIL,   // ← uncomment for demo/testing
        to: seller.email,   // ← actual seller email
        subject: `❌ Custom request "${creq.title}" has been cancelled`,
        html,
      }).catch((e) => console.error("[customRequest] cancel notify error:", e));
    }

    res.json({ message: "Request cancelled", request: creq });
  })
);

// @desc  Mark a custom request as completed (buyer)
// @route PUT /api/custom-requests/:id/complete
// @access Private (buyer who owns it)
router.put(
  "/:id/complete",
  protect,
  asyncHandler(async (req, res) => {
    const creq = await CustomRequest.findById(req.params.id);
    if (!creq) return res.status(404).json({ message: "Request not found" });
    if (String(creq.buyer) !== String(req.user._id))
      return res.status(403).json({ message: "Not your request" });
    if (creq.status !== "closed")
      return res.status(400).json({ message: "Can only mark closed requests as completed" });

    creq.status = "completed";
    await creq.save();
    res.json({ message: "Marked as completed", request: creq });
  })
);

// ─── BUYER — BID MANAGEMENT ───────────────────────────────────────────────────

// @desc  Accept a bid (buyer)
// @route PUT /api/custom-requests/:id/bids/:bidId/accept
// @access Private (buyer who owns the request)
router.put(
  "/:id/bids/:bidId/accept",
  protect,
  asyncHandler(async (req, res) => {
    const creq = await CustomRequest.findById(req.params.id)
      .populate("bids.seller", "name email phone sellerProfile.shopName sellerProfile.shopCity");

    if (!creq) return res.status(404).json({ message: "Request not found" });
    if (String(creq.buyer) !== String(req.user._id))
      return res.status(403).json({ message: "Not your request" });
    if (creq.status !== "open")
      return res.status(400).json({ message: "This request is no longer open" });

    const bid = creq.bids.id(req.params.bidId);
    if (!bid) return res.status(404).json({ message: "Bid not found" });

    // Accept this bid
    bid.status     = "accepted";
    bid.acceptedAt = new Date();

    // Reject all other pending bids
    creq.bids.forEach((b) => {
      if (String(b._id) !== String(bid._id) && b.status === "pending") {
        b.status = "rejected";
      }
    });

    creq.status         = "closed";
    creq.acceptedBid    = bid._id;
    creq.acceptedSeller = bid.seller._id || bid.seller;

    await creq.save();

    // Email the accepted seller
    const acceptedSeller = bid.seller;
    const buyer          = req.user;
    const html           = bidAcceptedToSeller({ seller: acceptedSeller, creq, bid, buyer });
    await sendMail({
      // to: TEST_EMAIL,           // ← uncomment for demo/testing
      to:  acceptedSeller.email,   // ← actual seller email
      subject: `🎉 Your bid was accepted — "${creq.title}" on Banavoo`,
      html,
    });

    // Email the other (rejected) sellers
    const rejectedBids = creq.bids.filter(
      (b) => b.status === "rejected" && String(b._id) !== String(bid._id)
    );
    for (const rb of rejectedBids) {
      const rSeller = rb.seller;
      if (!rSeller?.email) continue;
      const rHtml = requestClosedToOtherSellers({ seller: rSeller, creq });
      await sendMail({
        // to: TEST_EMAIL,   // ← uncomment for demo/testing
        to:  rSeller.email,  // ← actual seller email
        subject: `Custom request "${creq.title}" has been closed`,
        html:    rHtml,
      });
    }

    res.json({ message: "Bid accepted", request: creq });
  })
);

// @desc  Get my custom requests (buyer)
// @route GET /api/custom-requests/my/buyer
// @access Private
router.get(
  "/my/buyer",
  protect,
  asyncHandler(async (req, res) => {
    const creqs = await CustomRequest.find({ buyer: req.user._id })
      .populate("bids.seller", "name sellerProfile.shopName sellerProfile.rating phone email")
      .populate("acceptedSeller", "name phone email sellerProfile.shopName sellerProfile.shopCity")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ requests: creqs });
  })
);

// ─── SELLER ROUTES ────────────────────────────────────────────────────────────

// @desc  Get all open requests with seller's bid status mixed in
// @route GET /api/custom-requests/my/seller
// @access Private/Seller
router.get(
  "/my/seller",
  protect,
  requireSeller,
  asyncHandler(async (req, res) => {
    // "open" tab → only open requests
    // "mybids" tab → all requests this seller bid on (any status: open, closed, cancelled)
    const filter = req.query.mine === "true"
      ? { "bids.seller": req.user._id }
      : { status: "open" };

    const creqs = await CustomRequest.find(filter)
      .populate("buyer", "name avatar createdAt")
      .sort({ createdAt: -1 })
      .lean();

    // Annotate each request with this seller's own bid (if any)
    const annotated = creqs.map((c) => {
      const myBid = c.bids.find((b) => String(b.seller) === String(req.user._id));
      return { ...c, myBid: myBid || null };
    });

    res.json({ requests: annotated });
  })
);

// @desc  Place a bid on a custom request (seller)
// @route POST /api/custom-requests/:id/bids
// @access Private/Seller
router.post(
  "/:id/bids",
  protect,
  requireSeller,
  asyncHandler(async (req, res) => {
    const { price, deliveryDays, note } = req.body;

    if (!price || !deliveryDays)
      return res.status(400).json({ message: "price and deliveryDays are required" });

    const creq = await CustomRequest.findById(req.params.id)
      .populate("buyer", "name email");

    if (!creq) return res.status(404).json({ message: "Request not found" });
    if (creq.status !== "open")
      return res.status(400).json({ message: "This request is no longer accepting bids" });

    // Prevent duplicate bids from same seller
    const already = creq.bids.find((b) => String(b.seller) === String(req.user._id));
    if (already)
      return res.status(400).json({ message: "You already placed a bid on this request. Update it instead." });

    // Prevent buyer from bidding on their own request
    if (String(creq.buyer._id) === String(req.user._id))
      return res.status(400).json({ message: "You cannot bid on your own request" });

    creq.bids.push({
      seller:       req.user._id,
      price:        Number(price),
      deliveryDays: Number(deliveryDays),
      note:         note?.trim() || "",
    });

    await creq.save();

    // Notify buyer
    const buyer  = creq.buyer;
    const seller = req.user;
    const html   = newBidReceivedToBuyer({ buyer, creq, bid: creq.bids[creq.bids.length - 1], seller });
    await sendMail({
      // to: TEST_EMAIL,  // ← uncomment for demo/testing
      to:  buyer.email,   // ← actual buyer email
      subject: `💬 New bid on your request "${creq.title}" — Banavoo`,
      html,
    });

    res.status(201).json({ message: "Bid placed successfully", bids: creq.bids });
  })
);

// @desc  Update seller's own bid
// @route PUT /api/custom-requests/:id/bids/mine
// @access Private/Seller
router.put(
  "/:id/bids/mine",
  protect,
  requireSeller,
  asyncHandler(async (req, res) => {
    const creq = await CustomRequest.findById(req.params.id);
    if (!creq) return res.status(404).json({ message: "Request not found" });
    if (creq.status !== "open")
      return res.status(400).json({ message: "This request is no longer accepting bids" });

    const bid = creq.bids.find((b) => String(b.seller) === String(req.user._id));
    if (!bid) return res.status(404).json({ message: "You have not placed a bid on this request" });
    if (bid.status !== "pending")
      return res.status(400).json({ message: "Cannot update a bid that is already accepted/rejected" });

    if (req.body.price        !== undefined) bid.price        = Number(req.body.price);
    if (req.body.deliveryDays !== undefined) bid.deliveryDays = Number(req.body.deliveryDays);
    if (req.body.note         !== undefined) bid.note         = req.body.note.trim();

    await creq.save();
    res.json({ message: "Bid updated", bid });
  })
);

// @desc  Withdraw seller's own bid (only if still pending)
// @route DELETE /api/custom-requests/:id/bids/mine
// @access Private/Seller
router.delete(
  "/:id/bids/mine",
  protect,
  requireSeller,
  asyncHandler(async (req, res) => {
    const creq = await CustomRequest.findById(req.params.id);
    if (!creq) return res.status(404).json({ message: "Request not found" });
    if (creq.status !== "open")
      return res.status(400).json({ message: "Cannot withdraw a bid on a closed request" });

    const idx = creq.bids.findIndex((b) => String(b.seller) === String(req.user._id));
    if (idx === -1) return res.status(404).json({ message: "No bid found" });
    if (creq.bids[idx].status !== "pending")
      return res.status(400).json({ message: "Cannot withdraw an accepted bid" });

    creq.bids.splice(idx, 1);
    await creq.save();
    res.json({ message: "Bid withdrawn" });
  })
);

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────

// @desc  Admin force-cancel (or delete) a custom request
// @route DELETE /api/custom-requests/admin/:id
// @access Private/Admin
router.delete(
  "/admin/:id",
  protect,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const creq = await CustomRequest.findById(req.params.id)
      .populate("bids.seller", "name email sellerProfile.shopName");

    if (!creq) return res.status(404).json({ message: "Request not found" });

    const wasOpen = creq.status === "open";
    creq.status = "cancelled";
    await creq.save();

    // Notify any pending bidding sellers (fire-and-forget)
    if (wasOpen) {
      const biddingSellers = creq.bids.filter(
        (b) => b.status === "pending" && b.seller?.email
      );
      for (const bid of biddingSellers) {
        const seller = bid.seller;
        const creqWithPrice = { ...creq.toObject(), _bidPrice: bid.price };
        const html = requestCancelledToSeller({ seller, creq: creqWithPrice });
        sendMail({
          // to: TEST_EMAIL,   // ← testing mode
          to: seller.email,
          subject: `❌ Custom request "${creq.title}" has been cancelled`,
          html,
        }).catch((e) => console.error("[adminCancelRequest] notify error:", e));
      }
    }

    res.json({ message: "Request cancelled by admin" });
  })
);

export default router;
