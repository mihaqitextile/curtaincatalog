import { Request, Response, NextFunction } from "express";
import { jwtVerify } from "jose";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const accessToken = req.cookies.accessToken;
    if (!accessToken) {
      res.status(401).json({ success: false, error: "Not authenticated" });
      return;
    }

    const { payload } = await jwtVerify(
      accessToken,
      new TextEncoder().encode(process.env.JWT_SECRET)
    );

    req.user = {
      id: payload.userId as string,
      email: payload.email as string,
      role: payload.role as string,
    };

    next();
  } catch (error) {
    res.status(401).json({ success: false, error: "Invalid token" });
  }
};
