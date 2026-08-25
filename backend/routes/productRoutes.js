import express from "express";
import {
  getProducts, getProduct, getCategories, addReview,
  createProduct, updateProduct, deleteProduct, deleteProductImage, getMyProducts,
} from "../controllers/productController.js";
import { protect, requireSeller } from "../middleware/authMiddleware.js";
import { uploadProductImages } from "../config/cloudinary.js";

const router = express.Router();

// Public
router.get("/",             getProducts);
router.get("/categories",   getCategories);
router.get("/my",           protect, requireSeller, getMyProducts);   // must be before /:id
router.get("/:id",          getProduct);
router.post("/:id/review",  protect, addReview);

// Seller
router.post(   "/",              protect, requireSeller, uploadProductImages, createProduct);
router.put(    "/:id",           protect, requireSeller, uploadProductImages, updateProduct);
router.delete( "/:id",           protect, requireSeller, deleteProduct);
router.delete( "/:id/image/:publicId", protect, requireSeller, deleteProductImage);

export default router;
