import express from "express";
import { isAutheticated } from "../middleware/auth";
import { getLatestPurchasedCourse } from "../controllers/course-progress.controller";

const courseProgressRouter = express.Router();

// Get latest purchased course for current user
courseProgressRouter.get("/latest-course", isAutheticated, getLatestPurchasedCourse);

export default courseProgressRouter;