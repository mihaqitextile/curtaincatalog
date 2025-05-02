import { Router } from "express";
import {
  authenticateJwt,
  AuthenticatedRequest,
} from "../middleware/authMiddleware";
import { prisma } from "../db";
import { Response } from "express";

const router = Router();

// 更新用户信息
router.put(
  "/profile",
  authenticateJwt,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: "未授权访问" });
        return;
      }

      if (!name) {
        res.status(400).json({ error: "姓名不能为空" });
        return;
      }

      const updatedUser = await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          name,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      res.json({ user: updatedUser });
    } catch (error) {
      console.error("更新个人信息失败:", error);
      res.status(500).json({ error: "更新个人信息失败" });
    }
  }
);

export default router;
