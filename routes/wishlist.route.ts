import express from "express";
import {
    addWishCourse,
    addWishLesson,
    fetchWishListOfUser,
    deleteWishCourseFromWishListOfUser,
    removeWishItem,
    checkWishlistStatus
} from "../controllers/wishlist.controller";
import {
    isAutheticated
} from "../middleware/auth";

const wishListRouter = express.Router();

// Endpoints cho khóa học
wishListRouter.post('/wishlist/course', isAutheticated, addWishCourse);

// Endpoints cho bài học
wishListRouter.post('/wishlist/lesson', isAutheticated, addWishLesson);

// Endpoint lấy danh sách yêu thích (có thể filter theo type = 'course' hoặc 'lesson')
wishListRouter.get('/wishlist', isAutheticated, fetchWishListOfUser);

// Endpoint kiểm tra trạng thái yêu thích
wishListRouter.get('/wishlist/status', isAutheticated, checkWishlistStatus);

// Endpoint xóa theo id (giữ lại để tương thích ngược)
wishListRouter.delete('/wishlist', isAutheticated, deleteWishCourseFromWishListOfUser);

// Endpoint xóa linh hoạt (theo courseId, lessonId và type)
wishListRouter.delete('/wishlist/remove', isAutheticated, removeWishItem);

export default wishListRouter;
