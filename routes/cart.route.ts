import express from "express";
import { isAutheticated } from "../middleware/auth";
import { addCourseToCart, getCartOfUser, removeCourseFromCart } from "../controllers/cart.controller";
const cartRouter = express.Router();


cartRouter.get("/get-cart", isAutheticated, getCartOfUser);

cartRouter.put("/add-course", isAutheticated, addCourseToCart);

cartRouter.put('/delete-course', isAutheticated, removeCourseFromCart);

export default cartRouter;