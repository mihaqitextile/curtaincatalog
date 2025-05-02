import express from "express";
import { authenticateJwt, isSuperAdmin } from "../middleware/authMiddleware";
import { authenticateToken } from "../middleware/auth";
import {
  productImageUpload,
  productVideoUpload,
  handleUploadError,
  variantImageUpload,
} from "../middleware/uploadMiddleware";
import {
  createProduct,
  updateProduct,
  getProducts,
  getProductById,
  deleteProduct,
  getProductBySlug,
} from "../controllers/productController";
import { PrismaClient } from "@prisma/client";

const router = express.Router();
const prisma = new PrismaClient();

// 公开的产品列表 API
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const categoryId = req.query.categoryId as string;
    const search = req.query.search as string;
    const sort = (req.query.sort as string) || "newest";

    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: any = {};

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
      ];
    }

    // 构建排序条件
    let orderBy: any = { createdAt: "desc" };
    if (sort === "price_asc") {
      orderBy = { price: "asc" };
    } else if (sort === "price_desc") {
      orderBy = { price: "desc" };
    } else if (sort === "name_asc") {
      orderBy = { name: "asc" };
    } else if (sort === "name_desc") {
      orderBy = { name: "desc" };
    }

    // 查询产品
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: true,
          subcategory: true,
          variants: true,
          images: true,
        },
      }),
      prisma.product.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      products,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

// 获取所有产品（管理员）
router.get("/fetch-admin-products", authenticateJwt, isSuperAdmin, getProducts);

// 根据ID获取产品
router.get("/:id", authenticateToken, getProductById);

// 根据slug获取产品
router.get("/slug/:slug", authenticateToken, getProductBySlug);

// 检查产品代码是否存在
router.get("/check-code/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const product = await prisma.product.findUnique({
      where: { productCode: code },
    });
    res.json({ exists: !!product });
  } catch (error) {
    console.error("Error checking product code:", error);
    res.status(500).json({ error: "Failed to check product code" });
  }
});

// 创建产品（需要超级管理员权限）
router.post(
  "/create-new-product",
  authenticateToken,
  isSuperAdmin,
  variantImageUpload,
  handleUploadError,
  createProduct
);

// 更新产品（需要超级管理员权限）
router.put(
  "/:id",
  authenticateToken,
  isSuperAdmin,
  variantImageUpload,
  handleUploadError,
  updateProduct
);

// 删除产品（需要超级管理员权限）
router.delete("/:id", authenticateToken, isSuperAdmin, deleteProduct);

export default router;
