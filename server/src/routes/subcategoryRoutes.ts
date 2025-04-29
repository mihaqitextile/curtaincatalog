import express from "express";
import { authenticateJwt, isSuperAdmin } from "../middleware/authMiddleware";
import {
  createSubcategory,
  getSubcategories,
  getSubcategoryById,
  updateSubcategory,
  deleteSubcategory,
} from "../controllers/subcategoryController";

const router = express.Router();

// 获取所有子类别
router.get("/", getSubcategories);

// 根据ID获取子类别
router.get("/:id", getSubcategoryById);

// 创建子类别（需要超级管理员权限）
router.post("/", authenticateJwt, isSuperAdmin, createSubcategory);

// 更新子类别（需要超级管理员权限）
router.put("/:id", authenticateJwt, isSuperAdmin, updateSubcategory);

// 删除子类别（需要超级管理员权限）
router.delete("/:id", authenticateJwt, isSuperAdmin, deleteSubcategory);

export default router;
