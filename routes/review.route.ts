import express from 'express';
import { authorizeRoles, isAutheticated } from '../middleware/auth';
import { 
  addCourseReviewReply, 
  addMentorReviewReply, 
  createCourseReview, 
  createMentorReview, 
  deleteCourseReview, 
  deleteMentorReview, 
  getCourseReviews, 
  getMentorCourseReviews, 
  getMentorReviews, 
  updateCourseReview, 
  updateMentorReview 
} from '../controllers/review.controller';

const reivewRouter = express.Router();

// Course review routes
reivewRouter.post('/course/create', isAutheticated, createCourseReview);
reivewRouter.get('/course/:courseId', getCourseReviews);
reivewRouter.post('/course/reply/:reviewId', isAutheticated, addCourseReviewReply);
reivewRouter.put('/course/:id', isAutheticated, updateCourseReview);
reivewRouter.delete('/course/:id', isAutheticated, deleteCourseReview);

// Mentor review routes
reivewRouter.post('/mentor/create', isAutheticated, createMentorReview);
reivewRouter.get('/mentor/:mentorId', getMentorReviews);
reivewRouter.get('/mentor/courses/:mentorId', getMentorCourseReviews);
reivewRouter.post('/mentor/reply/:reviewId', isAutheticated, addMentorReviewReply);
reivewRouter.put('/mentor/:id', isAutheticated, updateMentorReview);
reivewRouter.delete('/mentor/:id', isAutheticated, deleteMentorReview);

export default reivewRouter;