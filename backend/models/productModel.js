import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    user:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name:    { type: String, required: true },
    rating:  { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
  },
  { timestamps: true }
);

const variantSchema = new mongoose.Schema({
  name:  { type: String, required: true }, // e.g. "Color", "Size"
  value: { type: String, required: true }, // e.g. "Red", "M"
  additionalPrice: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
});

const productSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Core info
    name:        { type: String, required: true, trim: true },
    slug:        { type: String, unique: true, lowercase: true },
    description: { type: String, required: true },
    shortDesc:   { type: String },

    // Media
    images: [
      {
        url:       { type: String, required: true },
        publicId:  { type: String },           // Cloudinary public_id
        isMain:    { type: Boolean, default: false },
      },
    ],

    // Pricing
    price:        { type: Number, required: true },
    comparePrice: { type: Number },            // crossed-out "was" price
    currency:     { type: String, default: "INR" },

    // Inventory
    stock:       { type: Number, required: true, default: 0 },
    sku:         { type: String },
    variants:    [variantSchema],

    // Category / tags
    category:    { type: String, required: true },
    subCategory: { type: String },
    tags:        [String],
    handmade:    { type: Boolean, default: true },   // always true for this platform

    // Delivery
    weight:        { type: Number },          // grams
    length:        { type: Number },          // cm
    width:         { type: Number },
    height:        { type: Number },
    freeShipping:  { type: Boolean, default: false },
    shippingCharge:{ type: Number, default: 0 }, // platform-calculates if 0

    // Ratings
    reviews:     [reviewSchema],
    rating:      { type: Number, default: 0 },
    numReviews:  { type: Number, default: 0 },

    // Status
    isActive:    { type: Boolean, default: true },
    isApproved:  { type: Boolean, default: true },  // auto-approve; set false for moderation
    isFeatured:  { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-generate slug from name
productSchema.pre("save", function (next) {
  if (this.isModified("name") && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") + "-" + Date.now();
  }
  next();
});

// Full-text search index
productSchema.index({ name: "text", description: "text", tags: "text" });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ seller: 1 });

const Product = mongoose.model("Product", productSchema);
export default Product;
