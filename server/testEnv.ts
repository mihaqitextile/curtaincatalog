import * as dotenv from "dotenv";

dotenv.config(); // 加载 .env 文件

console.log("DATABASE_URL:", process.env.DATABASE_URL); // 应该输出你在 .env 中配置的数据库 URL
console.log("JWT_SECRET:", process.env.JWT_SECRET); // 应该输出你在 .env 中配置的 JWT 密钥
