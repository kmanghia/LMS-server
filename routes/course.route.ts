import express from "express";
import { upload } from "../utils/multer"
import {
  addAnwser,
  addQuestion,
  addReplyToReview,
  addReview,
  deleteCourse,
  editCourse,
  getAdminAllCourses,
  getAllCourses,
  getCourseByUser,
  getSingleCourse,
  uploadCourse,
  createCourseDraft,
  submitCourseForApproval,
  updateCourseStatus,
  getPendingCourses,
} from "../controllers/course.controller";
import { authorizeRoles, isAutheticated } from "../middleware/auth";
const courseRouter = express.Router();

courseRouter.post(
  "/create-course",
  isAutheticated,
  authorizeRoles("admin"),
  upload.fields([
    { name: 'image', maxCount: 1 }, 
    { name: 'demo', maxCount: 1 }, 
    { name: 'videos', maxCount: 20 },
    { name: 'quiz_images', maxCount: 50 }
  ]) as any,
  uploadCourse
);

courseRouter.put(
  "/edit-course/:id",
  isAutheticated,
  authorizeRoles("admin", "mentor"),
  upload.fields([
    { name: 'imageedit', maxCount: 1 }, 
    { name: 'demoedit', maxCount: 1 }, 
    { name: 'videos', maxCount: 20 },
    { name: 'quiz_images', maxCount: 50 }
  ]) as any,
  editCourse
);

courseRouter.get("/get-course/:id", getSingleCourse);

courseRouter.get("/get-courses", getAllCourses);

courseRouter.get(
  "/get-admin-courses",
  isAutheticated,
  authorizeRoles("admin","mentor"),
  getAdminAllCourses
);

courseRouter.get("/get-course-content/:id", getCourseByUser);

courseRouter.put("/add-question", isAutheticated, addQuestion);

courseRouter.put("/add-answer", isAutheticated, addAnwser);

courseRouter.put("/add-review/:id", isAutheticated, addReview);

courseRouter.put(
  "/add-reply",
  isAutheticated,
  authorizeRoles("admin","mentor"),
  addReplyToReview
);

courseRouter.delete(
  "/delete-course/:id",
  isAutheticated,
  authorizeRoles("admin","mentor"),
  deleteCourse
);

courseRouter.post(
  "/create-draft",
  isAutheticated,
  authorizeRoles("mentor"),
  upload.fields([
    { name: 'image', maxCount: 1 }, 
    { name: 'demo', maxCount: 1 }, 
    { name: 'videos', maxCount: 20 },
    { name: 'quiz_images', maxCount: 50 }
  ]) as any,
  createCourseDraft
);

courseRouter.put(
  "/submit-for-approval/:courseId",
  isAutheticated,
  authorizeRoles("mentor"),
  submitCourseForApproval
);

courseRouter.put(
  "/update-status",
  isAutheticated,
  authorizeRoles("admin"),
  updateCourseStatus
);

courseRouter.get(
  "/pending",
  isAutheticated,
  authorizeRoles("admin"),
  getPendingCourses
);

export default courseRouter;
