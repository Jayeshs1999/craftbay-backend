import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User    from "../models/userModel.js";
import Product from "../models/productModel.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/craftbay";

const SELLER = {
  name:     "Priya Sharma",
  email:    "seller@demo.com",
  password: "demo1234",
  role:     "seller",
  isSeller: true,
  sellerProfile: {
    shopName:      "Priya's Handcraft Studio",
    shopDesc:      "Handmade jewellery, pottery and home decor crafted with love in Pune.",
    shopCity:      "Pune",
    shopState:     "Maharashtra",
    pickupPincode: "411001",
    rating:        4.8,
    isVerified:    true,
  },
};

const BUYER = {
  name:     "Rahul Verma",
  email:    "buyer@demo.com",
  password: "demo1234",
  role:     "buyer",
  isSeller: false,
};

// Generate slug from name (same logic as the model pre-save hook)
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now();
}

function makeImages(label) {
  const text = label.split(" ").slice(0, 3).join("+");
  return [{ url: "https://placehold.co/600x600/fef3e8/c05621?text=" + encodeURIComponent(text), isMain: true }];
}

const PRODUCTS_DATA = [
  {
    name: "Hand-painted Terracotta Vase",
    category: "Home Decor", subCategory: "Vases",
    description: "A beautiful hand-painted terracotta vase inspired by Rajasthani folk art. Each piece is unique and painted by hand using eco-friendly paints. Perfect for flowers or as a standalone decor piece.\n\nDimensions: 20cm height x 12cm width\nMaterial: Terracotta clay",
    shortDesc: "Folk-art painted terracotta vase, 20cm",
    price: 649, comparePrice: 899, stock: 15,
    tags: ["terracotta","handmade","home decor","vase"], weight: 400, freeShipping: false,
  },
  {
    name: "Macrame Wall Hanging",
    category: "Home Decor", subCategory: "Wall Art",
    description: "Handcrafted macrame wall hanging made with 100% natural cotton rope. Features a beautiful boho pattern.\n\nSize: 45cm x 90cm\nMaterial: Natural cotton rope\nComes with wooden dowel rod.",
    shortDesc: "Boho cotton macrame wall art, 45x90cm",
    price: 1199, comparePrice: 1599, stock: 8,
    tags: ["macrame","wall hanging","boho","cotton"], weight: 300, freeShipping: true,
  },
  {
    name: "Silver Filigree Earrings",
    category: "Jewellery", subCategory: "Earrings",
    description: "Delicate silver filigree earrings handcrafted by artisans in Cuttack, Odisha. Each pair takes over 3 hours to make.\n\nMaterial: 92.5 Sterling Silver\nLength: 4.5cm\nComes in a gift box.",
    shortDesc: "925 sterling silver filigree, 4.5cm",
    price: 849, comparePrice: 1100, stock: 20,
    tags: ["silver","filigree","earrings","odisha"], weight: 50, freeShipping: false,
  },
  {
    name: "Hand-block Printed Tote Bag",
    category: "Bags", subCategory: "Tote Bags",
    description: "Eco-friendly cotton tote bag with hand-block print using natural indigo dye. Each print is slightly unique.\n\nSize: 38cm x 42cm\nMaterial: 100% cotton canvas (350 GSM)\nWashable: Yes, cold wash",
    shortDesc: "Block-printed indigo cotton tote, 38x42cm",
    price: 349, comparePrice: 499, stock: 30,
    tags: ["tote bag","block print","indigo","cotton"], weight: 200, freeShipping: false,
  },
  {
    name: "Soy Wax Lavender Candle",
    category: "Candles", subCategory: "Scented Candles",
    description: "Handpoured soy wax candle with pure lavender essential oil. Clean burning, no toxins.\n\nBurn time: 40 hours\nWeight: 200g\nContainer: Reusable glass jar",
    shortDesc: "Handpoured soy wax, 40hr burn, lavender",
    price: 399, comparePrice: 549, stock: 25,
    tags: ["candle","soy wax","lavender","aromatherapy"], weight: 350, freeShipping: false,
  },
  {
    name: "Hand-embroidered Cushion Cover",
    category: "Home Decor", subCategory: "Cushion Covers",
    description: "Beautiful cushion cover with traditional Kantha embroidery from West Bengal. Made by women artisans.\n\nSize: 40cm x 40cm\nMaterial: Pure cotton\nCare: Gentle hand wash",
    shortDesc: "Kantha embroidery cotton cushion, 40x40cm",
    price: 549, comparePrice: 699, stock: 12,
    tags: ["cushion","kantha","embroidery","cotton"], weight: 150, freeShipping: false,
  },
  {
    name: "Blue Pottery Ceramic Mug",
    category: "Pottery", subCategory: "Mugs",
    description: "Authentic Jaipur blue pottery ceramic mug. Hand-painted with traditional blue and white floral patterns.\n\nCapacity: 300ml\nMaterial: Kaolinite clay\nHand wash recommended.",
    shortDesc: "Jaipur blue pottery 300ml ceramic mug",
    price: 449, comparePrice: 599, stock: 18,
    tags: ["blue pottery","ceramic mug","jaipur"], weight: 280, freeShipping: false,
  },
  {
    name: "Banana Fibre Clutch Purse",
    category: "Bags", subCategory: "Clutches",
    description: "Handwoven clutch purse made from sustainably sourced banana fibre. Eco-friendly alternative to synthetic bags.\n\nSize: 22cm x 14cm\nClosure: Magnetic snap",
    shortDesc: "Eco banana fibre handwoven clutch, 22x14cm",
    price: 599, comparePrice: 799, stock: 10,
    tags: ["clutch","banana fibre","eco-friendly","handwoven"], weight: 120, freeShipping: false,
  },
  {
    name: "Dhokra Brass Owl Figurine",
    category: "Home Decor", subCategory: "Figurines",
    description: "Traditional Dhokra craft brass owl figurine using the lost-wax casting technique, practised for over 4000 years.\n\nHeight: 10cm\nMaterial: Recycled brass\nFinish: Natural oxidised brass",
    shortDesc: "Dhokra brass owl, 10cm, lost-wax cast",
    price: 799, comparePrice: 1099, stock: 7,
    tags: ["dhokra","brass","owl","tribal craft"], weight: 180, freeShipping: false,
  },
  {
    name: "Handmade Lavender Body Scrub",
    category: "Skincare", subCategory: "Scrubs",
    description: "Natural handmade body scrub with lavender, sea salt and coconut oil. No preservatives, no parabens.\n\nQuantity: 150g\nShelf life: 6 months",
    shortDesc: "Natural lavender sea-salt body scrub, 150g",
    price: 299, comparePrice: 399, stock: 40,
    tags: ["body scrub","lavender","natural","skincare"], weight: 200, freeShipping: false,
  },
  {
    name: "Warli Art Wooden Frame",
    category: "Paintings", subCategory: "Wall Art",
    description: "Hand-painted Warli tribal art on a dark wooden frame. One of the oldest art forms of India.\n\nFrame size: 25cm x 30cm\nMedium: Natural pigment on wood\nReady to hang: Yes",
    shortDesc: "Warli tribal art on wooden frame, 25x30cm",
    price: 899, comparePrice: 1199, stock: 6,
    tags: ["warli art","tribal","painting","wooden frame"], weight: 350, freeShipping: true,
  },
  {
    name: "Handknit Woollen Beanie",
    category: "Clothing", subCategory: "Accessories",
    description: "Handknitted woollen beanie made from natural Himalayan wool. Warm, soft and perfect for winters.\n\nMaterial: 100% natural wool\nSize: One size fits most adults",
    shortDesc: "Handknit Himalayan wool beanie, one size",
    price: 499, comparePrice: 699, stock: 14,
    tags: ["beanie","wool","handknit","winter"], weight: 120, freeShipping: false,
  },
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB:", MONGO_URI);

  // Remove old demo users and their products
  const oldSeller = await User.findOne({ email: "seller@demo.com" });
  if (oldSeller) await Product.deleteMany({ seller: oldSeller._id });
  await User.deleteMany({ email: { $in: ["seller@demo.com", "buyer@demo.com"] } });

  // Create users (model pre-save hook hashes passwords)
  const seller = await User.create({ ...SELLER });
  await User.create({ ...BUYER });
  console.log("Created: seller@demo.com  password: demo1234");
  console.log("Created: buyer@demo.com   password: demo1234");

  // Insert products one-by-one via .save() so the pre-save slug hook fires
  let count = 0;
  for (const p of PRODUCTS_DATA) {
    const doc = new Product({
      ...p,
      seller:     seller._id,
      slug:       slugify(p.name),
      images:     makeImages(p.name),
      isActive:   true,
      isApproved: true,
      isFeatured: count < 4,
      rating:     +(3.5 + Math.random() * 1.4).toFixed(1),
      numReviews: Math.floor(Math.random() * 30) + 2,
    });
    await doc.save();
    count++;
    process.stdout.write(".");
  }
  console.log("\nSeeded " + count + " products");

  await mongoose.disconnect();
  console.log("Done!");
}

seed().catch((e) => { console.error(e.message); process.exit(1); });