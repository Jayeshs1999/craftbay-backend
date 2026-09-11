import express from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import { protect, requireSeller } from "../middleware/authMiddleware.js";
import User from "../models/userModel.js";
import Product from "../models/productModel.js";

const router = express.Router();

// ─── Delivery Config ──────────────────────────────────────────────────────────

// @desc  Get the authenticated seller's delivery config
// @route GET /api/sellers/delivery-config
// @access Private/Seller
router.get(
  "/delivery-config",
  protect,
  requireSeller,
  asyncHandler(async (req, res) => {
    const seller = await User.findById(req.user._id).select("sellerProfile.deliveryConfig").lean();
    const cfg = seller?.sellerProfile?.deliveryConfig || {};
    // Return with sensible defaults so frontend never gets undefined fields
    res.json({
      selfShipEnabled:       cfg.selfShipEnabled       ?? true,
      freeShippingAbove:     cfg.freeShippingAbove     ?? 0,
      localCharge:           cfg.localCharge           ?? 10,
      regionalCharge:        cfg.regionalCharge        ?? 10,
      nationalCharge:        cfg.nationalCharge        ?? 10,
      codEnabled:            cfg.codEnabled            ?? true,
      codExtraCharge:        cfg.codExtraCharge        ?? 30,
      estimatedDaysLocal:    cfg.estimatedDaysLocal    ?? 2,
      estimatedDaysRegional: cfg.estimatedDaysRegional ?? 4,
      estimatedDaysNational: cfg.estimatedDaysNational ?? 7,
      deliveryNote:          cfg.deliveryNote          ?? "",
    });
  })
);

// @desc  Update the authenticated seller's delivery config
// @route PUT /api/sellers/delivery-config
// @access Private/Seller
router.put(
  "/delivery-config",
  protect,
  requireSeller,
  asyncHandler(async (req, res) => {
    const allowed = [
      "selfShipEnabled", "freeShippingAbove",
      "localCharge", "regionalCharge", "nationalCharge",
      "codEnabled", "codExtraCharge",
      "estimatedDaysLocal", "estimatedDaysRegional", "estimatedDaysNational",
      "deliveryNote",
    ];

    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        update[`sellerProfile.deliveryConfig.${key}`] = req.body[key];
      }
    }

    const seller = await User.findByIdAndUpdate(
      req.user._id,
      { $set: update },
      { new: true, runValidators: true }
    ).select("sellerProfile.deliveryConfig").lean();

    const cfg = seller?.sellerProfile?.deliveryConfig || {};
    res.json({
      selfShipEnabled:       cfg.selfShipEnabled       ?? true,
      freeShippingAbove:     cfg.freeShippingAbove     ?? 0,
      localCharge:           cfg.localCharge           ?? 10,
      regionalCharge:        cfg.regionalCharge        ?? 10,
      nationalCharge:        cfg.nationalCharge        ?? 10,
      codEnabled:            cfg.codEnabled            ?? true,
      codExtraCharge:        cfg.codExtraCharge        ?? 30,
      estimatedDaysLocal:    cfg.estimatedDaysLocal    ?? 2,
      estimatedDaysRegional: cfg.estimatedDaysRegional ?? 4,
      estimatedDaysNational: cfg.estimatedDaysNational ?? 7,
      deliveryNote:          cfg.deliveryNote          ?? "",
    });
  })
);

// @desc  List all active sellers with product count + up to 4 preview images
// @route GET /api/sellers
// @access Public
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 20;
    const skip  = (page - 1) * limit;

    const filter = { isSeller: true, isActive: true };
    if (req.query.q) {
      const regex = new RegExp(req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { "sellerProfile.shopName": regex },
        { "sellerProfile.shopCity": regex },
        { name: regex },
      ];
    }
    if (req.query.state) {
      filter["sellerProfile.shopState"] = req.query.state;
    }

    const [sellers, total] = await Promise.all([
      User.find(filter)
        .select("name sellerProfile")
        .sort({ "sellerProfile.totalSales": -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    // For each seller fetch product count + up to 4 preview images
    const enriched = await Promise.all(
      sellers.map(async (seller) => {
        const products = await Product.find({ seller: seller._id, isActive: true, isApproved: true })
          .select("images name price")
          .sort({ createdAt: -1 })
          .limit(4)
          .lean();

        const productCount = await Product.countDocuments({
          seller: seller._id, isActive: true, isApproved: true,
        });

        return {
          _id:          seller._id,
          name:         seller.name,
          sellerProfile: seller.sellerProfile,
          productCount,
          previewImages: products.flatMap((p) =>
            p.images
              .filter((img) => img.isMain || p.images.indexOf(img) === 0)
              .slice(0, 1)
              .map((img) => ({ url: img.url, productName: p.name, price: p.price }))
          ),
        };
      })
    );

    // Only return sellers who have at least one product
    const withProducts = enriched.filter((s) => s.productCount > 0);

    res.json({
      sellers: withProducts,
      page,
      pages: Math.ceil(total / limit),
      total: withProducts.length,
    });
  })
);

export default router;
