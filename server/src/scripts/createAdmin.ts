import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const prisma = new PrismaClient();

async function createOrUpdateAdmin() {
  try {
    const email = "admin@gmail.com";
    const password = "admin"; // 修改为新密码
    const name = "Admin";

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    const hashedPassword = await bcrypt.hash(password, 12);

    if (existingUser) {
      // 更新现有用户的密码
      const updatedUser = await prisma.user.update({
        where: { email },
        data: {
          password: hashedPassword,
        },
      });
      console.log("Admin password updated successfully");
      return;
    }

    // 创建新用户
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: "SUPER_ADMIN",
      },
    });

    console.log("Admin user created successfully");
  } catch (error) {
    console.error("Error managing admin user:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createOrUpdateAdmin();
