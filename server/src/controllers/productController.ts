import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { prisma } from "../db";
import { Prisma, PrismaClient } from "@prisma/client";
import cloudinary from "../config/cloudinary";
import { slugify } from "../utils/slugify";
import path from "path";
import fs from "fs";
import { compressVideo, getVideoInfo } from "../utils/videoCompressor";
import { Request } from "express";

const prismaClient = new PrismaClient();

// 定义 Cloudinary 上传结果类型
interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

// 定义产品变体类型
interface ProductVariant {
  color: string;
  size: string;
  stock?: number;
  sku: string;
  price?: number;
}

// 定义产品图片创建类型
interface ProductImageCreateInput {
  url: string;
  color?: string | null;
  isMain: boolean;
  isThumbnail: boolean;
  order: number;
}

interface UploadResult {
  url: string;
}

async function uploadImage(file: Express.Multer.File): Promise<UploadResult> {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      // 上传到 Cloudinary
      const result = await cloudinary.uploader.upload(file.path, {
        folder: "products",
        resource_type: "auto",
        timeout: 60000, // 60 seconds timeout
        use_filename: true,
        unique_filename: true,
        overwrite: true,
      });

      // 删除本地文件
      fs.unlinkSync(file.path);

      // Validate the URL
      if (
        !result.secure_url ||
        !result.secure_url.startsWith("https://res.cloudinary.com")
      ) {
        throw new Error("Invalid Cloudinary response URL");
      }

      // 确保URL使用HTTPS
      const url = result.secure_url.replace("http://", "https://");

      return { url };
    } catch (error) {
      attempt++;
      console.error(
        `Error uploading to Cloudinary (attempt ${attempt}/${maxRetries}):`,
        error
      );

      if (attempt === maxRetries) {
        throw new Error(
          `Failed to upload image after ${maxRetries} attempts: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  throw new Error("Failed to upload image");
}

// 计算产品所有变体中的最低价格
function calculateLowestPrice(variants: any[]): number {
  if (!variants || variants.length === 0) return 0;

  // 遍历所有变体，找出所有尺寸中的最低价格
  let lowestPrice = Number.MAX_VALUE;

  for (const variant of variants) {
    if (variant.sizePrices && typeof variant.sizePrices === "object") {
      const prices = Object.values(variant.sizePrices);
      for (const price of prices) {
        const numPrice = Number(price);
        if (!isNaN(numPrice) && numPrice > 0 && numPrice < lowestPrice) {
          lowestPrice = numPrice;
        }
      }
    }
  }

  return lowestPrice === Number.MAX_VALUE ? 0 : lowestPrice;
}

// 计算产品所有变体的总库存
function calculateTotalStock(variants: any[]): number {
  if (!variants || variants.length === 0) return 0;

  let totalStock = 0;

  for (const variant of variants) {
    if (variant.sizeStocks && typeof variant.sizeStocks === "object") {
      const stocks = Object.values(variant.sizeStocks);
      for (const stock of stocks) {
        const numStock = Number(stock);
        if (!isNaN(numStock) && numStock > 0) {
          totalStock += numStock;
        }
      }
    }
  }

  return totalStock;
}

// 创建产品
export const createProduct = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    console.log("Received product creation request");
    console.log("Request headers:", req.headers);
    console.log("Request body:", req.body);
    console.log("Request files:", req.files);

    const {
      name,
      productCode,
      brand,
      description,
      material,
      weight,
      craft,
      origin,
      isFeatured,
      variants,
      categoryId,
      subcategoryId,
    } = req.body;

    // Validate required fields with detailed error messages
    const missingFields = [];
    if (!name) missingFields.push("name");
    if (!productCode) missingFields.push("productCode");
    if (!categoryId) missingFields.push("categoryId");
    if (!brand) missingFields.push("brand");
    if (!description) missingFields.push("description");

    if (missingFields.length > 0) {
      console.log("Missing required fields:", missingFields);
      res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(", ")}`,
        details: {
          receivedFields: Object.keys(req.body),
          missingFields,
        },
      });
      return;
    }

    // Parse and validate variants data
    let parsedVariants;
    try {
      // Check if variants data is chunked
      const chunksTotal = parseInt(req.body.variants_chunks_total || "1");
      let variantsData = "";

      if (chunksTotal > 1) {
        // Reconstruct the variants data from chunks
        for (let i = 0; i < chunksTotal; i++) {
          const chunk = req.body[`variants_chunk_${i}`];
          if (chunk) {
            variantsData += chunk;
          }
        }
      } else {
        // Use the original variants field if not chunked
        variantsData = req.body.variants || "[]";
      }

      console.log("Raw variants data:", variantsData);
      console.log("Variants data length:", variantsData.length);

      try {
        parsedVariants = JSON.parse(variantsData);
      } catch (parseError: any) {
        console.error("JSON parse error:", parseError);
        res.status(400).json({
          success: false,
          error: "Invalid JSON format in variants data",
          details: {
            parseError: parseError.message,
            receivedData: variantsData,
          },
        });
        return;
      }

      console.log("Parsed variants:", parsedVariants);

      if (!Array.isArray(parsedVariants)) {
        res.status(400).json({
          success: false,
          error: "Variants must be an array",
          details: {
            receivedType: typeof parsedVariants,
            receivedValue: parsedVariants,
          },
        });
        return;
      }

      // Validate each variant
      for (const variant of parsedVariants) {
        console.log("Validating variant:", variant);

        if (!variant.color) {
          res.status(400).json({
            success: false,
            error: "Each variant must have a color",
            details: {
              invalidVariant: variant,
            },
          });
          return;
        }
        if (!Array.isArray(variant.sizes)) {
          res.status(400).json({
            success: false,
            error: "Each variant must have a sizes array",
            details: {
              invalidVariant: variant,
            },
          });
          return;
        }

        // Validate sizePrices and sizeStocks
        if (variant.sizePrices) {
          console.log("Size prices for variant:", variant.sizePrices);
          if (typeof variant.sizePrices !== "object") {
            res.status(400).json({
              success: false,
              error: "sizePrices must be an object",
              details: {
                invalidVariant: variant,
                receivedType: typeof variant.sizePrices,
              },
            });
            return;
          }
        }

        if (variant.sizeStocks) {
          console.log("Size stocks for variant:", variant.sizeStocks);
          if (typeof variant.sizeStocks !== "object") {
            res.status(400).json({
              success: false,
              error: "sizeStocks must be an object",
              details: {
                invalidVariant: variant,
                receivedType: typeof variant.sizeStocks,
              },
            });
            return;
          }
        }
      }
    } catch (error) {
      console.error("Error processing variants:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({
        success: false,
        error: "Error processing variants data",
        details: {
          errorMessage,
          errorStack:
            process.env.NODE_ENV === "development" && error instanceof Error
              ? error.stack
              : undefined,
          receivedData: req.body.variants,
        },
      });
      return;
    }

    // Process images
    const uploadedFiles = req.files as {
      [fieldname: string]: Express.Multer.File[];
    };
    console.log("Uploaded files:", uploadedFiles);

    if (
      !uploadedFiles ||
      !uploadedFiles["images"] ||
      uploadedFiles["images"].length === 0
    ) {
      console.log("No main images were uploaded");
      res.status(400).json({
        success: false,
        error: "At least one main image is required",
        details: {
          receivedFiles: uploadedFiles ? Object.keys(uploadedFiles) : [],
        },
      });
      return;
    }

    // Process main images
    const mainImages = uploadedFiles["images"] || [];
    console.log("Main images:", mainImages);
    const mainImageUrls = await Promise.all(
      mainImages.map(async (file) => {
        const result = await uploadImage(file);
        return result.url;
      })
    );
    console.log("Main image URLs:", mainImageUrls);

    // Process variant images
    const variantImageUrls: { [color: string]: string } = {};
    const variantImages = uploadedFiles["variantImages"] || [];
    console.log(`Variant images:`, variantImages);

    // Create a map of variant colors to their corresponding images
    const variantColorMap = new Map();
    parsedVariants.forEach((variant, index) => {
      if (variantImages[index]) {
        variantColorMap.set(variant.color, variantImages[index]);
      }
    });

    // Upload each variant image
    for (const [color, file] of variantColorMap.entries()) {
      try {
        const uploadResult = await uploadImage(file);
        variantImageUrls[color] = uploadResult.url;
        console.log(
          `Uploaded variant image for color ${color}:`,
          variantImageUrls[color]
        );
      } catch (error) {
        console.error(
          `Error uploading variant image for color ${color}:`,
          error
        );
      }
    }
    console.log("All variant image URLs:", variantImageUrls);

    // Process video if exists
    let videoUrl = null;
    const videoFiles = uploadedFiles["video"] || [];
    console.log("Video files:", videoFiles);
    if (videoFiles.length > 0) {
      try {
        const uploadResult = await uploadImage(videoFiles[0]);
        videoUrl = uploadResult.url;
        console.log("Uploaded video URL:", videoUrl);
      } catch (error) {
        console.error("Error uploading video:", error);
      }
    }

    // Create product in database
    console.log("Creating product with data:", {
      name,
      productCode,
      categoryId,
      subcategoryId,
      variantImageUrls,
    });

    const product = await prisma.product.create({
      data: {
        name,
        slug: slugify(name),
        productCode,
        brand,
        description,
        material,
        weight,
        craft,
        origin,
        isFeatured: isFeatured === "true",
        gender: "unisex",
        price: calculateLowestPrice(parsedVariants),
        stock: calculateTotalStock(parsedVariants),
        category: {
          connect: {
            id: categoryId,
          },
        },
        ...(subcategoryId && {
          subcategory: {
            connect: {
              id: subcategoryId,
            },
          },
        }),
        videoUrl,
        images: {
          create: [
            ...mainImageUrls.map((url, index) => ({
              url,
              isMain: index === 0,
              isThumbnail: false,
              order: index,
            })),
            ...Object.entries(variantImageUrls).map(([color, url]) => ({
              url,
              color,
              isMain: false,
              isThumbnail: true,
              order: 0,
            })),
          ],
        },
        variants: {
          create: parsedVariants.map((variant: any) => ({
            color: variant.color,
            sizes: variant.sizes || [],
            sizePrices: variant.sizePrices || {},
            sizeStocks: variant.sizeStocks || {},
            sku: variant.sku || "",
          })),
        },
      },
      include: {
        images: true,
        variants: true,
        category: true,
        subcategory: true,
      },
    });

    console.log("Product created successfully:", product);

    // Clean up uploaded files
    const allFiles = [
      ...mainImages,
      ...Object.values(variantImageUrls).flat(),
      ...videoFiles,
    ];
    console.log("Cleaning up files:", allFiles);
    for (const file of allFiles) {
      if (file && typeof file === "object" && "path" in file) {
        try {
          fs.unlinkSync(file.path);
          console.log("Deleted file:", file.path);
        } catch (error) {
          console.error("Error deleting file:", error);
        }
      }
    }

    res.status(201).json({
      success: true,
      data: product,
      redirect: "/super-admin/products/list",
    });
  } catch (error) {
    console.error("Error creating product:", error);
    // Log the request body and files for debugging
    console.error("Request body:", req.body);
    console.error("Request files:", req.files);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorName = error instanceof Error ? error.name : "UnknownError";
    const errorCode = error instanceof Error ? (error as any).code : undefined;

    // Check for specific validation errors
    if (errorName === "PrismaClientValidationError") {
      res.status(400).json({
        success: false,
        error: "Invalid data format: " + errorMessage,
      });
      return;
    }

    if (errorCode === "P2002") {
      res.status(400).json({
        success: false,
        error: "A product with this code already exists",
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: errorMessage || "Failed to create product",
      details:
        process.env.NODE_ENV === "development" && error instanceof Error
          ? error.stack
          : undefined,
    });
  }
};

// 获取所有产品
export const getProducts = async (req: Request, res: Response) => {
  try {
    console.log("Fetching admin products");
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 6;
    const skip = (page - 1) * limit;

    console.log("Query parameters:", { page, limit, skip });

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        skip,
        take: limit,
        include: {
          category: true,
          subcategory: true,
          variants: true,
          images: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.product.count(),
    ]);

    console.log("Fetched products:", {
      count: products.length,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
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
    console.error("Error in getProducts:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch products",
      details:
        process.env.NODE_ENV === "development" && error instanceof Error
          ? error.message
          : undefined,
    });
  }
};

// 根据ID获取产品
export const getProductById = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { id } = req.params;

    const product = await prismaClient.product.findUnique({
      where: { id },
      include: {
        category: true,
        subcategory: true,
        variants: true,
        images: true,
      },
    });

    if (!product) {
      res.status(404).json({ success: false, error: "Product not found" });
      return;
    }

    res.status(200).json({ success: true, product });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// 删除产品
export const deleteProduct = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { id } = req.params;

    // 获取产品信息，包括视频URL
    const product = (await prisma.product.findUnique({
      where: { id },
    })) as any;

    if (!product) {
      res.status(404).json({ success: false, error: "Product not found" });
      return;
    }

    // 删除产品
    await prisma.product.delete({
      where: { id },
    });

    // 如果产品有视频，删除视频文件
    if (product.videoUrl) {
      const videoPath = path.join(process.cwd(), "public", product.videoUrl);
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
    }

    res
      .status(200)
      .json({ success: true, message: "Product deleted successfully" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};

// 更新产品
export const updateProduct = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { id } = req.params;
    const {
      name,
      productCode,
      brand,
      description,
      material,
      weight,
      craft,
      origin,
      categoryId,
      subcategoryId,
      isFeatured,
      variants_chunks_total,
    } = req.body;

    // Reconstruct variants data from chunks
    let variantsData = "";
    const chunksTotal = parseInt(variants_chunks_total || "1");

    if (chunksTotal > 1) {
      for (let i = 0; i < chunksTotal; i++) {
        const chunk = req.body[`variants_chunk_${i}`];
        if (chunk) {
          variantsData += chunk;
        }
      }
    } else {
      variantsData = req.body.variants || "[]";
    }

    let parsedVariants;
    try {
      parsedVariants = JSON.parse(variantsData);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Invalid variants data format",
      });
      return;
    }

    // Get the existing product to check if it exists
    const existingProduct = await prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
        variants: true,
      },
    });

    if (!existingProduct) {
      res.status(404).json({
        success: false,
        error: "Product not found",
      });
      return;
    }

    // Handle file uploads
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const mainImages = files["images"] || [];
    const video = files["video"]?.[0];

    // Process variant thumbnails
    const variantThumbnails: { [key: string]: Express.Multer.File[] } = {};
    Object.keys(files).forEach((key) => {
      if (key.startsWith("variantThumbnails-")) {
        const color = key.replace("variantThumbnails-", "");
        variantThumbnails[color] = files[key];
      }
    });

    // Update product in database
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        name,
        productCode,
        brand,
        description,
        material,
        weight,
        craft,
        origin,
        isFeatured: isFeatured === "true",
        slug: slugify(name),
        category: {
          connect: {
            id: categoryId,
          },
        },
        ...(subcategoryId && {
          subcategory: {
            connect: {
              id: subcategoryId,
            },
          },
        }),
        // 计算并更新主产品价格（取所有变体中的最低价格）
        price: calculateLowestPrice(parsedVariants),
        // 计算并更新总库存
        stock: calculateTotalStock(parsedVariants),
        // Delete existing variants and create new ones
        variants: {
          deleteMany: {},
          create: parsedVariants.map((variant: any) => ({
            color: variant.color,
            sizes: variant.sizes || [],
            sizePrices: variant.sizePrices || {},
            sizeStocks: variant.sizeStocks || {},
            sku: variant.sku || "",
          })),
        },
      },
      include: {
        images: true,
        variants: true,
        category: true,
        subcategory: true,
      },
    });

    // Handle image uploads
    if (mainImages.length > 0 || Object.keys(variantThumbnails).length > 0) {
      // Delete existing images first
      await prisma.productImage.deleteMany({
        where: { productId: id },
      });

      // Upload and create new images
      const imagePromises = [];

      // Handle main images
      for (const file of mainImages) {
        const uploadResult = await uploadImage(file);
        imagePromises.push(
          prisma.productImage.create({
            data: {
              url: uploadResult.url,
              productId: updatedProduct.id,
              isMain: true,
              isThumbnail: false,
              order: 0,
            },
          })
        );
      }

      // Handle variant thumbnails
      for (const [color, files] of Object.entries(variantThumbnails)) {
        for (const file of files) {
          const uploadResult = await uploadImage(file);
          imagePromises.push(
            prisma.productImage.create({
              data: {
                url: uploadResult.url,
                productId: updatedProduct.id,
                color,
                isMain: false,
                isThumbnail: true,
                order: 0,
              },
            })
          );
        }
      }

      await Promise.all(imagePromises);
    }

    // Handle video upload
    if (video) {
      const uploadResult = await uploadImage(video);
      await prisma.product.update({
        where: { id },
        data: {
          videoUrl: uploadResult.url,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update product",
    });
  }
};

// 根据slug获取产品
export const getProductBySlug = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const { slug } = req.params;
    console.log("Fetching product by slug:", slug);
    console.log("User:", req.user);

    if (!req.user) {
      console.error("No user found in request");
      res.status(401).json({
        success: false,
        error: "Authentication required",
      });
      return;
    }

    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        subcategory: true,
        variants: true,
        images: true,
      },
    });

    if (!product) {
      console.log("Product not found for slug:", slug);
      res.status(404).json({
        success: false,
        error: "Product not found",
      });
      return;
    }

    console.log("Product found:", product.id);
    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Error in getProductBySlug:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch product",
      details:
        process.env.NODE_ENV === "development" && error instanceof Error
          ? error.message
          : undefined,
    });
  }
};
