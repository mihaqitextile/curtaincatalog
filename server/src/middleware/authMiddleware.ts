import { NextFunction, Request, Response } from "express";
import { jwtVerify } from "jose";
import { TextEncoder } from "util";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticateJwt = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  // 从 cookie 或 Authorization 头中获取 token
  const accessToken =
    req.cookies.accessToken || req.headers.authorization?.split(" ")[1];

  console.log(
    "Auth middleware - Token from cookie:",
    req.cookies.accessToken ? "Exists" : "Not found"
  );
  console.log(
    "Auth middleware - Token from header:",
    req.headers.authorization ? "Exists" : "Not found"
  );
  console.log(
    "Auth middleware - Final token:",
    accessToken ? "Exists" : "Not found"
  );

  if (!accessToken) {
    console.log("Auth middleware - No token found, returning 401");
    res
      .status(401)
      .json({ success: false, error: "Access token is not present" });
    return;
  }

  try {
    console.log("Auth middleware - Verifying token");
    const { payload } = await jwtVerify(
      accessToken,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );
    console.log("Auth middleware - Token verified, payload:", payload);
    req.user = {
      id: payload.userId as string,
      email: payload.email as string,
      role: payload.role as string,
    };
    next();
  } catch (e) {
    console.error("Auth middleware - Token verification failed:", e);
    res.status(401).json({ success: false, error: "Invalid access token" });
  }
};

export const isSuperAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.user && req.user.role === "SUPER_ADMIN") {
    next();
  } else {
    res.status(403).json({
      success: false,
      error: "Access Denied! Super admin access required",
    });
  }
};
