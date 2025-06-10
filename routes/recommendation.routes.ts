import express from 'express';
import recommendationController from '../controllers/recommendation.controller';
import { isAutheticated } from '../middleware/auth';

const router = express.Router();

// Áp dụng middleware xác thực cho tất cả các routes
router.use(isAutheticated);

// Route cho content-based recommendations
router.get('/content-based/:userId', recommendationController.getContentBasedRecommendations);

// Route cho item-based recommendations
router.get('/item-based', recommendationController.getItemBasedRecommendations);

// Route cho user-based recommendations
router.get('/user-based', recommendationController.getUserBasedRecommendations);

// Route cho similar courses
router.get('/similarV2/:courseId', recommendationController.getSimilarCourses);

// Route cho popular courses
router.get('/popularWT', recommendationController.getPopularCourses);

// Route cho all recommendations
router.get('/all/:userId', recommendationController.getAllRecommendations);

// Route kiểm tra kết nối tới Python API
router.get('/test-connection', recommendationController.testConnection);

export default router; 