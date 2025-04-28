import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import userModel from "../models/user.model";
import CourseModel, { ICourse } from "../models/course.model";

export const getCartOfUser = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = await userModel.findById(req.user?._id).select("cart");
            let coursesInCart: ICourse[] = [];
            if (user && user.cart.length > 0) {
                let courseIds = user.cart.map((item) => item.courseId);
                coursesInCart = await CourseModel.find({ _id: { $in: courseIds } });
            }
            res.status(201).json({
                success: true,
                coursesInCart: coursesInCart,
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400))
        }
    }
)

export const addCourseToCart = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = await userModel.findById(req.user?._id).select("cart");
            const { _id } = req.body as ICourse;
            const existCourseInCart = user?.cart.find((item) => item.courseId === _id);
            if (existCourseInCart) {
                return next(
                    new ErrorHandler("Bạn đã có khóa học này trong giỏ hàng", 400)
                );
            }
            user?.cart.unshift({ courseId: _id.toString() });
            await user?.save();
            let courseIds = user?.cart.map((item) => item.courseId);
            let coursesInCart: ICourse[] = [];
            coursesInCart = await CourseModel.find({ _id: { $in: courseIds } });
            res.status(201).json({
                success: true,
                coursesInCart: coursesInCart
            })
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
)

export const removeCourseFromCart = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = await userModel.findById(req.user?._id).select("cart");
            const { _id } = req.body as ICourse; // id của khoá học
            if (user?.cart) {
                const existCourseInCart = user?.cart.some((item) => item.courseId === _id);//check xem khoá học đã tồn tại trong giỏ hàng hay chưa
                if (!existCourseInCart) {
                    return next(new ErrorHandler("Khóa học không tồn tại trong giỏ hàng", 400));
                }
                let currCart = user.cart;
                currCart = currCart.filter(item => item.courseId !== _id); // lọc khoá học từ giỏ hàng
                user.cart = currCart;
                await user.save();
            }
            res.status(202).json({
                success: true,
                message: "Xóa khóa học khỏi giỏ hàng thành công"
            })
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
)