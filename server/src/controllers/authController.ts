import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { Request, Response } from "express";
import { SignJWT } from "jose";
import { TextEncoder } from "util";
import { v4 as uuidv4 } from "uuid";

async function generateToken(userId: string, email: string, role: string) {
  const accessToken = await new SignJWT({
    userId,
    email,
    role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("60m")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));

  const refreshToken = uuidv4();
  return { accessToken, refreshToken };
}

async function setTokens(
  res: Response,
  accessToken: string,
  refreshToken: string
) {
  res.cookie("accessToken", accessToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 60 * 60 * 1000, // 1 hour
    path: "/",
  });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  });
}

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ success: false, error: "Email already in use" });
      return;
    }
    const hashPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashPassword,
        role: "USER",
      },
    });
    res.status(201).json({
      message: "User created successfully",
      success: true,
      userId: user.id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Registration failed" });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    console.log("Login attempt for email:", email);
    console.log("Request body:", req.body);
    console.log("JWT Secret:", process.env.JWT_SECRET ? "Exists" : "Missing");

    if (!email || !password) {
      console.log("Missing email or password");
      res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    console.log("Found user:", user ? "Yes" : "No");
    if (user) {
      console.log("User role:", user.role);
    }

    if (!user) {
      console.log("User not found for email:", email);
      res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log("Password valid:", isPasswordValid);

    if (!isPasswordValid) {
      console.log("Invalid password for email:", email);
      res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
      return;
    }

    try {
      const { accessToken, refreshToken } = await generateToken(
        user.id,
        user.email,
        user.role
      );
      console.log("Tokens generated successfully");

      await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken },
      });
      console.log("Refresh token updated in database");

      await setTokens(res, accessToken, refreshToken);
      console.log("Tokens set in cookies");

      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
    } catch (tokenError) {
      console.error("Token generation error:", tokenError);
      throw tokenError;
    }
  } catch (error) {
    console.error("Login error:", error);
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace"
    );
    res.status(500).json({
      success: false,
      error: "Login failed",
      details:
        process.env.NODE_ENV === "development"
          ? error instanceof Error
            ? error.message
            : "Unknown error"
          : undefined,
    });
  }
};

export const refreshAccessToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    res.status(401).json({ success: false, error: "Invalid refresh token" });
    return;
  }
  try {
    const user = await prisma.user.findFirst({
      where: {
        refreshToken: refreshToken,
      },
    });
    if (!user) {
      res.status(401).json({ success: false, error: "User Not Found" });
      return;
    }
    const { accessToken, refreshToken: newRefreshToken } = await generateToken(
      user.id,
      user.email,
      user.role
    );

    // Update refresh token in database
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    await setTokens(res, accessToken, newRefreshToken);
    res.status(200).json({
      success: true,
      message: "Access token refreshed successfully",
      user: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to refresh access token" });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to logout" });
  }
};

export const getCurrentUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const accessToken = req.cookies.accessToken;
    if (!accessToken) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user?.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Failed to get user" });
  }
};
