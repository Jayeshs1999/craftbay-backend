import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

// Configure cloudinary lazily so dotenv has time to load
function getCloudinaryStorage() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const hasCredentials = !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_CLOUD_NAME !== "your_cloud_name" &&
    process.env.CLOUDINARY_API_KEY    &&
    process.env.CLOUDINARY_API_KEY    !== "your_api_key"
  );

  return { hasCredentials };
}

// Build multer instances lazily on first use
let _productUpload = null;
let _avatarUpload  = null;

function getProductUpload() {
  if (_productUpload) return _productUpload;

  const { hasCredentials } = getCloudinaryStorage();

  const storage = hasCredentials
    ? new CloudinaryStorage({
        cloudinary,
        params: {
          folder:          "craftbay/products",
          allowed_formats: ["jpg", "jpeg", "png", "webp"],
          transformation:  [{ width: 1000, height: 1000, crop: "limit", quality: "auto" }],
        },
      })
    : multer.memoryStorage();

  _productUpload = { upload: multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }).array("images", 6), hasCredentials };
  return _productUpload;
}

function getAvatarUpload() {
  if (_avatarUpload) return _avatarUpload;

  const { hasCredentials } = getCloudinaryStorage();

  const storage = hasCredentials
    ? new CloudinaryStorage({
        cloudinary,
        params: {
          folder:          "craftbay/avatars",
          allowed_formats: ["jpg", "jpeg", "png", "webp"],
          transformation:  [{ width: 400, height: 400, crop: "fill", gravity: "face", quality: "auto" }],
        },
      })
    : multer.memoryStorage();

  _avatarUpload = { upload: multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } }).single("avatar"), hasCredentials };
  return _avatarUpload;
}

export const uploadProductImages = (req, res, next) => {
  const { upload, hasCredentials } = getProductUpload();
  upload(req, res, (err) => {
    if (err) {
      const msg = hasCredentials
        ? err.message
        : "Image upload skipped: add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET to your .env";
      return next(new Error(msg));
    }
    if (!hasCredentials) req.files = [];
    next();
  });
};

export const uploadAvatar = (req, res, next) => {
  const { upload, hasCredentials } = getAvatarUpload();
  upload(req, res, (err) => {
    if (err) return next(err);
    if (!hasCredentials) req.file = undefined;
    next();
  });
};

export { cloudinary };