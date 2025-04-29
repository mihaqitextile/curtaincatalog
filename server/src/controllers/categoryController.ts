import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { prisma } from "../db";
import { slugify } from "../utils/slugify";

// 创建类别
export const createCategory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, description, slug, subcategories } = req.body;

    const category = await prisma.category.create({
      data: {
        name,
        slug: slug || slugify(name),
        description,
        subcategories: {
          create:
            subcategories?.map((sub: { name: string; slug: string }) => ({
              name: sub.name,
              slug: sub.slug || slugify(sub.name),
            })) || [],
        },
      },
      include: {
        subcategories: true,
      },
    });

    res.status(201).json({ success: true, category });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, error: "Failed to create category" });
  }
};

// 获取所有类别
export const getCategories = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        subcategories: true,
        products: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(200).json({ success: true, categories });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch categories" });
  }
};

// 根据ID获取类别
export const getCategoryById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        subcategories: true,
        products: {
          include: {
            images: true,
            variants: true,
          },
        },
      },
    });

    if (!category) {
      res.status(404).json({ success: false, error: "Category not found" });
      return;
    }

    res.status(200).json({ success: true, category });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Failed to fetch category" });
  }
};

// 更新类别
export const updateCategory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, subcategories } = req.body;

    // 首先删除现有的子类别
    await prisma.subcategory.deleteMany({
      where: { categoryId: id },
    });

    // 更新类别并创建新的子类别
    const category = await prisma.category.update({
      where: { id },
      data: {
        name,
        slug: slugify(name),
        description,
        subcategories: {
          create:
            subcategories?.map((sub: { name: string; slug: string }) => ({
              name: sub.name,
              slug: sub.slug || slugify(sub.name),
            })) || [],
        },
      },
      include: {
        subcategories: true,
      },
    });

    res.status(200).json({ success: true, category });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, error: "Failed to update category" });
  }
};

// 删除类别
export const deleteCategory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // 检查类别是否有关联的产品
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        products: true,
        subcategories: true,
      },
    });

    if (!category) {
      res.status(404).json({ success: false, error: "Category not found" });
      return;
    }

    if (category.products.length > 0) {
      res.status(400).json({
        success: false,
        error: "Cannot delete category with associated products",
      });
      return;
    }

    // 删除所有子类别
    if (category.subcategories.length > 0) {
      await prisma.subcategory.deleteMany({
        where: { categoryId: id },
      });
    }

    // 删除类别
    await prisma.category.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete category" });
  }
};
