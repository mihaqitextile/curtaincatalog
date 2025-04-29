import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // 创建超级管理员
  const email = "admin@gmail.com";
  const password = "123456";
  const name = "Super Admin";

  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" },
  });

  if (!existingSuperAdmin) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const superAdminUser = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: "SUPER_ADMIN",
      },
    });
    console.log("Super admin created successfully", superAdminUser.email);
  }

  // 检查并创建示例分类
  let category = await prisma.category.findUnique({
    where: { slug: "curtains" },
  });

  if (!category) {
    category = await prisma.category.create({
      data: {
        name: "窗帘",
        slug: "curtains",
        description: "高品质窗帘产品",
        image: "https://example.com/curtains.jpg",
      },
    });
    console.log("Category created successfully");
  }

  // 检查并创建示例子分类
  let subcategory = await prisma.subcategory.findUnique({
    where: { slug: "living-room-curtains" },
  });

  if (!subcategory) {
    subcategory = await prisma.subcategory.create({
      data: {
        name: "客厅窗帘",
        slug: "living-room-curtains",
        description: "客厅专用窗帘",
        image: "https://example.com/living-room-curtains.jpg",
        categoryId: category.id,
      },
    });
    console.log("Subcategory created successfully");
  }

  // 检查并创建示例产品
  let product = await prisma.product.findUnique({
    where: { slug: "modern-simple-curtain" },
  });

  if (!product) {
    product = await prisma.product.create({
      data: {
        name: "现代简约窗帘",
        productCode: "CUR001",
        slug: "modern-simple-curtain",
        brand: "CurtainsCo",
        description: "一款现代简约风格的窗帘，适合各种家居环境",
        material: "涤纶",
        weight: "200g/m²",
        craft: "印花",
        origin: "中国",
        categoryId: category.id,
        subcategoryId: subcategory.id,
        gender: "unisex",
        price: 299.99,
        stock: 100,
        isFeatured: true,
      },
    });
    console.log("Product created successfully");

    // 创建产品变体
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        color: "米白色",
        size: "标准",
        sizes: ["标准", "加长"],
        sizePrices: {
          标准: 299.99,
          加长: 399.99,
        },
        sizeStocks: {
          标准: 50,
          加长: 50,
        },
      },
    });
    console.log("Product variant created successfully");

    // 创建产品图片
    await prisma.productImage.createMany({
      data: [
        {
          productId: product.id,
          url: "https://example.com/curtain-1.jpg",
          color: "米白色",
          isMain: true,
          isThumbnail: true,
          order: 1,
        },
        {
          productId: product.id,
          url: "https://example.com/curtain-2.jpg",
          color: "米白色",
          isMain: false,
          isThumbnail: true,
          order: 2,
        },
      ],
    });
    console.log("Product images created successfully");
  }

  console.log("Seed data process completed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
