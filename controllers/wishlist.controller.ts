import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import wishlistModel from "../models/wishlist.model";
export const addWishCourse = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?._id;
            const { courseId } = req.body;

            const response = await wishlistModel.create({
                userId: userId,
                courseId: courseId
            });

            return res.status(200).json({
                success: true,
                data: response
            })

        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
)
export const fetchWishListOfUser = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?._id;
            const response = await wishlistModel.find({
                userId: userId
            });

            return res.status(200).json({
                success: true,
                data: response
            })
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
)
export const deleteWishCourseFromWishListOfUser = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.query;
            await wishlistModel.findByIdAndDelete(id);

            return res.status(200).json({
                success: true
            })
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
)