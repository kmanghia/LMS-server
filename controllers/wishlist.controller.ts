import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import wishlistModel from "../models/wishlist.model";
import CourseModel from "../models/course.model";
import mongoose from "mongoose";

// Helper function để lấy thông tin bài học từ courseId và contentId
async function getLessonDetails(courseId: string, lessonId: string) {
    try {
        // Chuyển đổi chuỗi ID thành ObjectId nếu cần
        const courseObjectId = mongoose.Types.ObjectId.isValid(courseId) 
            ? new mongoose.Types.ObjectId(courseId) 
            : courseId;
            
        const course = await CourseModel.findById(courseObjectId);
        
        if (!course) {
            return null;
        }
        
        // Tìm bài học trong courseData
        const lesson = course.courseData.find(
            (content: any) => content._id.toString() === lessonId
        );
        
        if (!lesson) {
            return null;
        }
        
        return {
            course: {
                _id: course._id,
                name: course.name,
                thumbnail: course.thumbnail
            },
            lesson: {
                _id: lesson._id,
                title: lesson.title,
                videoSection: lesson.videoSection,
                videoThumbnail: lesson.videoThumbnail
            }
        };
    } catch (error) {
        console.error("Error getting lesson details:", error);
        return null;
    }
}

// Kiểm tra trạng thái yêu thích của khóa học hoặc bài học
export const checkWishlistStatus = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?._id;
            const { courseId, lessonId, type } = req.query;

            if (!courseId || !type || (type === 'lesson' && !lessonId)) {
                return res.status(400).json({
                    success: false,
                    message: "Thiếu thông tin cần thiết"
                });
            }

            const query: any = {
                userId: userId,
                courseId: courseId,
                type: type
            };

            if (type === 'lesson') {
                query.lessonId = lessonId;
            }

            const item = await wishlistModel.findOne(query);

            return res.status(200).json({
                success: true,
                isFavorited: !!item // Chuyển đổi item thành boolean
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
);

export const addWishCourse = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?._id;
            const { courseId } = req.body;

            // Kiểm tra xem đã tồn tại trong wishlist chưa
            const existingWishlist = await wishlistModel.findOne({
                userId: userId,
                courseId: courseId,
                type: 'course'
            });

            if (existingWishlist) {
                return res.status(400).json({
                    success: false,
                    message: "Khóa học đã có trong danh sách yêu thích"
                });
            }

            const response = await wishlistModel.create({
                userId: userId,
                courseId: courseId,
                type: 'course'
            });

            return res.status(200).json({
                success: true,
                data: response
            });

        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
);

export const addWishLesson = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?._id;
            const { courseId, lessonId } = req.body;

            if (!courseId || !lessonId) {
                return res.status(400).json({
                    success: false,
                    message: "courseId và lessonId là bắt buộc"
                });
            }

            // Kiểm tra xem đã tồn tại trong wishlist chưa
            const existingWishlist = await wishlistModel.findOne({
                userId: userId,
                courseId: courseId,
                lessonId: lessonId,
                type: 'lesson'
            });

            if (existingWishlist) {
                return res.status(400).json({
                    success: false,
                    message: "Bài học đã có trong danh sách yêu thích"
                });
            }

            const response = await wishlistModel.create({
                userId: userId,
                courseId: courseId,
                lessonId: lessonId,
                type: 'lesson'
            });

            return res.status(200).json({
                success: true,
                data: response
            });

        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
);

export const fetchWishListOfUser = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?._id;
            const { type } = req.query;
            
            let query: any = { userId: userId };
            
            // Nếu có type thì filter theo type
            if (type && (type === 'course' || type === 'lesson')) {
                query.type = type;
            }
            
            const wishlistItems = await wishlistModel.find(query).sort({ createdAt: -1 });
            
            // Nếu có yêu cầu lấy thông tin chi tiết
            if (req.query.withDetails === 'true') {
                // Xử lý riêng cho từng loại
                const enrichedItems = await Promise.all(
                    wishlistItems.map(async (item) => {
                        const itemObj = item.toObject();
                        
                        if (item.type === 'course') {
                            // Lấy thông tin khóa học
                            const course = await CourseModel.findById(item.courseId, 
                                'name thumbnail description categories level');
                                
                            if (course) {
                                return { 
                                    ...itemObj, 
                                    courseDetails: course.toObject() 
                                };
                            }
                        } 
                        else if (item.type === 'lesson' && item.lessonId) {
                            // Lấy thông tin bài học
                            const details = await getLessonDetails(
                                item.courseId.toString(), 
                                item.lessonId.toString()
                            );
                            
                            if (details) {
                                return { 
                                    ...itemObj, 
                                    details 
                                };
                            }
                        }
                        
                        return itemObj;
                    })
                );
                
                return res.status(200).json({
                    success: true,
                    data: enrichedItems
                });
            }
            
            return res.status(200).json({
                success: true,
                data: wishlistItems
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
);

export const deleteWishCourseFromWishListOfUser = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.query;
            await wishlistModel.findByIdAndDelete(id);

            return res.status(200).json({
                success: true
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
);

export const removeWishItem = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?._id;
            const { courseId, lessonId, type } = req.body;

            if (!courseId || !type) {
                return res.status(400).json({
                    success: false,
                    message: "courseId và type là bắt buộc"
                });
            }

            let query: any = {
                userId: userId,
                courseId: courseId,
                type: type
            };

            // Nếu là bài học thì cần lessonId
            if (type === 'lesson') {
                if (!lessonId) {
                    return res.status(400).json({
                        success: false,
                        message: "lessonId là bắt buộc khi xóa bài học yêu thích"
                    });
                }
                query.lessonId = lessonId;
            }

            const result = await wishlistModel.findOneAndDelete(query);

            if (!result) {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy item trong danh sách yêu thích"
                });
            }

            return res.status(200).json({
                success: true,
                message: type === 'course' ? "Đã xóa khóa học khỏi danh sách yêu thích" : "Đã xóa bài học khỏi danh sách yêu thích"
            });
        } catch (error: any) {
            return next(new ErrorHandler(error.message, 400));
        }
    }
);