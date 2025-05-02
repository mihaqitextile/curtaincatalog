import express from "express";
import {
  login,
  logout,
  refreshAccessToken,
  register,
  getCurrentUser,
} from "../controllers/authController";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh-token", refreshAccessToken);
router.post("/logout", logout);
router.get("/me", authenticateToken, getCurrentUser);

export default router;
