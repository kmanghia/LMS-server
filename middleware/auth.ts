import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "./catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import jwt, { JwtPayload } from "jsonwebtoken";
import { redis } from "../utils/redis";
import { updateAccessToken } from "../controllers/user.controller";


export const isAutheticated = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    const access_token = req.headers["access-token"] as string;
    if (!access_token) {
      return next(
        new ErrorHandler("Vui lòng đăng nhập để truy cập tài nguyên này", 400)
      );
    }
    const decoded = jwt.decode(access_token) as JwtPayload
    if (!decoded) {
      return next(new ErrorHandler("access token không hợp lệ", 400));
    }

    if (decoded.exp && decoded.exp <= Date.now() / 1000) {
      try {
        await updateAccessToken(req, res, next);
      } catch (error) {
        return next(error);
      }
    } else {
      const user = await redis.get(decoded.id);

      if (!user) {
        return next(
          new ErrorHandler("Vui lòng đăng nhập để truy cập tài nguyên này", 400)
        );
      }

      req.user = JSON.parse(user);

      next();
    }
  }
);


export const authorizeRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user?.role || "")) {
      return next(
        new ErrorHandler(
          `Vai trò: ${req.user?.role} không có quyền truy cập vào tài nguyên này`,
          403
        )
      );
    }
    next();
  };
};
