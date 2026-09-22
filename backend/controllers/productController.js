import asyncHandler from "../middleware/asyncHandler.js";
import Product from "../models/productModel.js";
import { cloudinary } from "../config/cloudinary.js";

// -----------------------------------------------------------------------------
// PUBLIC - no auth required
// -----------------------------------------------------------------------------

// @desc  List products (search, filter, sort, paginate)
// @route GET /api/products
// @access Public
export const getProducts = asyncHandler(async (req, res) => {
  const page     = Number(req.query.page)     || 1;
  const limit    = Number(req.query.limit)    || 20;
  const skip     = (page - 1) * limit;

  const filter   = { isActive: true, isApproved: true };

  if (req.query.q) {
    const term = req.query.q.trim();
    if (term) {
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { name: regex },
        { description: regex },
        { shortDesc: regex },
        { category: regex },
        { tags: regex },
      ];
    }
  }
  if (req.query.category)    filter.category    = req.query.category;
  if (req.query.subCategory) filter.subCategory = req.query.subCategory;
  if (req.query.seller)      filter.seller       = req.query.seller;
  if (req.query.minPrice || req.query.maxPrice) {
    filter.price = {};
    if (req.query.minPrice) filter.price.$gte = Number(req.query.minPrice);
    if (req.query.maxPrice) filter.price.$lte = Number(req.query.maxPrice);
  }
  if (req.query.featured === "true") filter.isFeatured = true;

  const sortMap = {
    newest:    { createdAt: -1 },
    oldest:    { createdAt:  1 },
    "price-asc":  { price:  1 },
    "price-desc": { price: -1 },
    rating:    { rating: -1 },
    popular:   { numReviews: -1 },
  };
  const sort = sortMap[req.query.sort] || { createdAt: -1 };

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select("-reviews")
      .populate("seller", "name sellerProfile.shopName sellerProfile.rating"),
    Product.countDocuments(filter),
  ]);

  res.json({
    products,
    page,
    pages:  Math.ceil(total / limit),
    total,
  });
});

// @desc  Get single product by id or slug
// @route GET /api/products/:id
// @access Public
export const getProduct = asyncHandler(async (req, res) => {
  const q = req.params.id.match(/^[0-9a-fA-F]{24}$/)
    ? { _id: req.params.id }
    : { slug: req.params.id };

  const product = await Product.findOne({ ...q, isActive: true })
    .populate("seller", "name avatar sellerProfile")
    .populate("reviews.user", "name avatar");

  if (!product) { res.status(404); throw new Error("Product not found"); }

  // Normalize customization fields — older docs pre-date these fields and have undefined values
  const data = product.toObject();
  if (!data.isCustomizable)    data.isCustomizable    = false;
  if (!data.customizationDays) data.customizationDays = 0;
  if (!data.customizationNote) data.customizationNote = "";

  res.json(data);
});

// @desc  Get a single product for editing (ignores isActive; verifies ownership)
// @route GET /api/products/:id/edit
// @access Private/Seller
export const getProductForEdit = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) { res.status(404); throw new Error("Product not found"); }
  if (product.seller.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    res.status(403); throw new Error("Not authorized");
  }
  res.json(product);
});

// @desc  Get distinct categories
// @route GET /api/products/categories
// @access Public
export const getCategories = asyncHandler(async (req, res) => {
  const categories = await Product.distinct("category", { isActive: true });
  res.json(categories);
});

// @desc  Submit a review
// @route POST /api/products/:id/review
// @access Private
export const addReview = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) { res.status(404); throw new Error("Product not found"); }

  const alreadyReviewed = product.reviews.find(
    (r) => r.user.toString() === req.user._id.toString()
  );
  if (alreadyReviewed) { res.status(400); throw new Error("Already reviewed"); }

  const { rating, comment } = req.body;
  product.reviews.push({ user: req.user._id, name: req.user.name, rating, comment });
  product.numReviews = product.reviews.length;
  product.rating = product.reviews.reduce((a, r) => a + r.rating, 0) / product.numReviews;
  await product.save();
  res.status(201).json({ message: "Review added" });
});

// -----------------------------------------------------------------------------
// SELLER - auth + isSeller required
// -----------------------------------------------------------------------------

// @desc  Create a product
// @route POST /api/products
// @access Private/Seller
export const createProduct = asyncHandler(async (req, res) => {
  const {
    name, description, shortDesc, price, comparePrice,
    stock, sku, category, subCategory, tags, variants,
    weight, length, width, height, freeShipping, shippingCharge,
    isCustomizable, customizationDays, customizationNote,
  } = req.body;

  // Uploaded files come from multer-cloudinary
  const images = (req.files || []).map((f, i) => ({
    url:      f.path,
    publicId: f.filename,
    isMain:   i === 0,
  }));

  const product = await Product.create({
    seller: req.user._id,
    name, description, shortDesc, price: Number(price),
    comparePrice: comparePrice ? Number(comparePrice) : undefined,
    stock: Number(stock), sku, category, subCategory,
    tags: typeof tags === "string" ? tags.split(",").map((t) => t.trim()) : tags,
    variants: variants ? JSON.parse(variants) : [],
    weight: weight ? Number(weight) : undefined,
    length: length ? Number(length) : undefined,
    width:  width  ? Number(width)  : undefined,
    height: height ? Number(height) : undefined,
    freeShipping: freeShipping === "true",
    shippingCharge: shippingCharge ? Number(shippingCharge) : 0,
    images,
    isCustomizable: isCustomizable === "true" || isCustomizable === true,
    customizationDays: customizationDays ? Number(customizationDays) : 0,
    customizationNote: customizationNote || "",
  });

  res.status(201).json(product);
});

// @desc  Update own product
// @route PUT /api/products/:id
// @access Private/Seller
export const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) { res.status(404); throw new Error("Product not found"); }
  if (product.seller.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    res.status(403); throw new Error("Not authorized");
  }

  const allowed = [
    "name","description","shortDesc","price","comparePrice","stock","sku",
    "category","subCategory","tags","weight","length","width","height",
    "freeShipping","shippingCharge","isActive",
    "isCustomizable","customizationDays","customizationNote",
  ];
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) product[key] = req.body[key];
  });

  // Append new images if uploaded
  if (req.files && req.files.length > 0) {
    const newImgs = req.files.map((f, i) => ({
      url: f.path, publicId: f.filename, isMain: product.images.length === 0 && i === 0,
    }));
    product.images.push(...newImgs);
  }

  const updated = await product.save();
  res.json(updated);
});

// @desc  Delete own product (soft delete)
// @route DELETE /api/products/:id
// @access Private/Seller
export const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) { res.status(404); throw new Error("Product not found"); }
  if (product.seller.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    res.status(403); throw new Error("Not authorized");
  }

  product.isActive = false;
  await product.save();
  res.json({ message: "Product removed" });
});

// @desc  Delete a product image
// @route DELETE /api/products/:id/image/:publicId
// @access Private/Seller
export const deleteProductImage = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) { res.status(404); throw new Error("Product not found"); }
  if (product.seller.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    res.status(403); throw new Error("Not authorized");
  }

  const { publicId } = req.body;
  if (!publicId) { res.status(400); throw new Error("publicId is required"); }

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (cloudErr) {
    console.error("Cloudinary destroy failed:", cloudErr?.message || cloudErr);
    // Still remove from DB even if Cloudinary fails (orphaned asset is preferable to stuck UI)
  }
  product.images = product.images.filter((img) => img.publicId !== publicId);
  await product.save();
  res.json(product.images);
});

// @desc  Get seller's own products
// @route GET /api/products/my
// @access Private/Seller
export const getMyProducts = asyncHandler(async (req, res) => {
  const page  = Number(req.query.page)  || 1;
  const limit = Number(req.query.limit) || 20;
  const filter = { seller: req.user._id };
  if (req.query.active) filter.isActive = req.query.active === "true";

  const [docs, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
  ]);

  // Normalize customization fields for older documents
  const products = docs.map((p) => {
    const d = p.toObject();
    if (!d.isCustomizable)    d.isCustomizable    = false;
    if (!d.customizationDays) d.customizationDays = 0;
    if (!d.customizationNote) d.customizationNote = "";
    return d;
  });

  res.json({ products, page, pages: Math.ceil(total / limit), total });
});
