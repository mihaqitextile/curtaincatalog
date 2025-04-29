import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { prisma } from "../db";
import { slugify } from "../utils/slugify";

// 创建子类别
export const createSubcategory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { categoryId } = req.params;
    const { name, description } = req.body;

    // 检查父类别是否存在
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      res.status(404).json({ success: false, error: "Category not found" });
      return;
    }

    const subcategory = await prisma.subcategory.create({
      data: {
        name,
        slug: slugify(name),
        description,
        category: {
          connect: { id: categoryId },
        },
      },
    });

    res.status(201).json({ success: true, subcategory });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, error: "Failed to create subcategory" });
  }
};

// 获取类别的所有子类别
export const getSubcategories = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { categoryId } = req.params;

    const subcategories = await prisma.subcategory.findMany({
      where: {
        categoryId,
      },
      include: {
        products: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(200).json({ success: true, subcategories });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch subcategories" });
  }
};

// 根据ID获取子类别
export const getSubcategoryById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id, categoryId } = req.params;

    const subcategory = await prisma.subcategory.findFirst({
      where: {
        id,
        categoryId,
      },
      include: {
        category: true,
        products: {
          include: {
            images: true,
            variants: true,
          },
        },
      },
    });

    if (!subcategory) {
      res.status(404).json({ success: false, error: "Subcategory not found" });
      return;
    }

    res.status(200).json({ success: true, subcategory });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch subcategory" });
  }
};

// 更新子类别
export const updateSubcategory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id, categoryId } = req.params;
    const { name, description } = req.body;

    const subcategory = await prisma.subcategory.update({
      where: {
        id,
        categoryId,
      },
      data: {
        name,
        slug: slugify(name),
        description,
      },
    });

    res.status(200).json({ success: true, subcategory });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, error: "Failed to update subcategory" });
  }
};

// 删除子类别
export const deleteSubcategory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id, categoryId } = req.params;

    // 检查子类别是否有关联的产品
    const subcategory = await prisma.subcategory.findFirst({
      where: {
        id,
        categoryId,
      },
      include: {
        products: true,
      },
    });

    if (!subcategory) {
      res.status(404).json({ success: false, error: "Subcategory not found" });
      return;
    }

    if (subcategory.products.length > 0) {
      res.status(400).json({
        success: false,
        error: "Cannot delete subcategory with associated products",
      });
      return;
    }

    await prisma.subcategory.delete({
      where: {
        id,
        categoryId,
      },
    });

    res.status(200).json({
      success: true,
      message: "Subcategory deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete subcategory" });
  }
};
