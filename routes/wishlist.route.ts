import express from "express";
import {
    addWishCourse,
    fetchWishListOfUser,
    deleteWishCourseFromWishListOfUser
} from "../controllers/wishlist.controller";
import {
    isAutheticated
} from "../middleware/auth";

const wishListRouter = express.Router();

wishListRouter.post('/wishlist', isAutheticated, addWishCourse);

wishListRouter.get('/wishlist', isAutheticated, fetchWishListOfUser);

wishListRouter.delete('/wishlist', isAutheticated, deleteWishCourseFromWishListOfUser);

export default wishListRouter;
