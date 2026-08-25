import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Product images — up to 5 MB, jpg/png/webp
const productStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          "craftbay/products",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation:  [{ width: 1000, height: 1000, crop: "limit", quality: "auto" }],
  },
});

// Avatar / shop banner — up to 2 MB
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          "craftbay/avatars",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation:  [{ width: 400, height: 400, crop: "fill", gravity: "face", quality: "auto" }],
  },
});

export const uploadProductImages = multer({
  storage: productStorage,
  limits:  { fileSize: 5 * 1024 * 1024 },
}).array("images", 6);            // max 6 images per product

export const uploadAvatar = multer({
  storage: avatarStorage,
  limits:  { fileSize: 2 * 1024 * 1024 },
}).single("avatar");

export { cloudinary };
