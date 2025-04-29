import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载根目录下的 .env 文件
dotenv.config({ path: join(__dirname, "..", ".env") });

export const prisma = new PrismaClient();
