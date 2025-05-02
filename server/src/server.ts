import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import authRoutes from "./routes/authRoutes";
import productRoutes from "./routes/productRoutes";
import categoryRoutes from "./routes/categoryRoutes";
import userRoutes from "./routes/user";
import fs from "fs";
import iconv from "iconv-lite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载 .env 文件
const envPath = join(__dirname, "..", ".env");

// 检查 .env 文件是否存在
if (!fs.existsSync(envPath)) {
  console.error("❌ .env 文件不存在，请确保已创建 .env 文件");
  process.exit(1);
}

// 读取并解析 .env 文件
const fileBuffer = fs.readFileSync(envPath);
const envContent = iconv.decode(fileBuffer, "utf8");
console.log("📄 已加载 .env 文件");

const envConfig = dotenv.parse(envContent);

// 手动设置环境变量
Object.entries(envConfig).forEach(([key, value]) => {
  process.env[key] = value;
});

console.log("✅ .env 文件加载成功");
console.log("Database URL:", process.env.DATABASE_URL);
console.log("JWT Secret:", process.env.JWT_SECRET);

// 检查关键环境变量
if (!process.env.JWT_SECRET || !process.env.DATABASE_URL) {
  console.error("❌ 缺少必要的环境变量 (JWT_SECRET 或 DATABASE_URL)");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// 错误处理中间件
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("服务器错误:", err);
    console.error("错误堆栈:", err.stack);
    res.status(500).json({
      success: false,
      error: "服务器内部错误",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
);

// CORS 配置
const corsOptions = {
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 静态文件服务
app.use("/videos", express.static(join(__dirname, "..", "public", "videos")));
app.use("/uploads", express.static(join(__dirname, "..", "uploads")));

export const prisma = new PrismaClient();

// 添加请求日志中间件
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  console.log("Request headers:", req.headers);
  console.log("Request body:", req.body);
  next();
});

// API 路由
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/user", userRoutes);

// 添加一个通配符路由来捕获所有未匹配的路由
app.use("*", (req, res) => {
  console.log("404 Not Found:", req.method, req.originalUrl);
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.originalUrl,
  });
});

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

// 服务器监听
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Environment variables loaded:", {
    PORT: process.env.PORT,
    NODE_ENV: process.env.NODE_ENV,
    JWT_SECRET_EXISTS: !!process.env.JWT_SECRET, // 🔥注意是 JWT_SECRET，不是 NEXT_PUBLIC_JWT_SECRET
    DATABASE_URL_EXISTS: !!process.env.DATABASE_URL,
  });
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit();
});
