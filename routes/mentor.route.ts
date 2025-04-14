import express from "express";
import { authorizeRoles, isAutheticated } from "../middleware/auth";
import { 
  registerAsMentor, 
  getMentorInfo, 
  updateMentorStatus, 
  getAllMentors, 
  getPendingMentors, 
  reviewMentor, 
  getMentorCourses,
  getMentorById,
  getMentorStudents,
  getMentorStudentsByMentorId
} from "../controllers/mentor.controller";

const router = express.Router();

// Đăng ký làm mentor
router.post("/register", registerAsMentor);

// Lấy thông tin mentor
router.get("/me-mentor", isAutheticated, getMentorInfo);

// Admin phê duyệt/từ chối mentor
router.put("/update-status", isAutheticated, authorizeRoles("admin"), updateMentorStatus);


router.get("/all", isAutheticated, getAllMentors);

// Admin lấy danh sách mentor đang chờ duyệt
router.get("/pending", isAutheticated, authorizeRoles("admin"), getPendingMentors);

// User đánh giá mentor
router.post("/review", isAutheticated, reviewMentor);

// Lấy danh sách khóa học của mentor hiện tại
router.get("/courses", isAutheticated, getMentorCourses);

// Lấy danh sách học viên của mentor
router.get("/students", isAutheticated, getMentorStudents);

// Lấy danh sách học viên của mentor theo mentorId
router.get("/students/:mentorId", getMentorStudentsByMentorId);

// Lấy thông tin chi tiết mentor theo ID
router.get("/:id", getMentorById);

export default router; 