import express from "express";
import { authenticateJwt, isSuperAdmin } from "../middleware/authMiddleware";
import {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController";
import {
  createSubcategory,
  getSubcategories,
  getSubcategoryById,
  updateSubcategory,
  deleteSubcategory,
} from "../controllers/subcategoryController";

const router = express.Router();

// 获取所有类别
router.get("/", getCategories);

// 根据ID获取类别
router.get("/:id", getCategoryById);

// 创建类别（需要超级管理员权限）
router.post("/", authenticateJwt, isSuperAdmin, createCategory);

// 更新类别（需要超级管理员权限）
router.put("/:id", authenticateJwt, isSuperAdmin, updateCategory);

// 删除类别（需要超级管理员权限）
router.delete("/:id", authenticateJwt, isSuperAdmin, deleteCategory);

// 子类别路由（嵌套在类别下）
router.get("/:categoryId/subcategories", getSubcategories);
router.get("/:categoryId/subcategories/:id", getSubcategoryById);
router.post(
  "/:categoryId/subcategories",
  authenticateJwt,
  isSuperAdmin,
  createSubcategory
);
router.put(
  "/:categoryId/subcategories/:id",
  authenticateJwt,
  isSuperAdmin,
  updateSubcategory
);
router.delete(
  "/:categoryId/subcategories/:id",
  authenticateJwt,
  isSuperAdmin,
  deleteSubcategory
);

export default router;
