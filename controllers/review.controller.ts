import { Request, Response, NextFunction } from 'express';
import ErrorHandler from '../utils/ErrorHandler';
import { CatchAsyncError } from '../middleware/catchAsyncErrors';
import CourseModel from '../models/course.model';
import MentorModel from '../models/mentor.model';
import CourseReviewModel from '../models/review_courses.model';
import MentorReviewModel from '../models/review_mentors.model';
import mongoose from 'mongoose';
import { redis } from '../utils/redis';

// ------ COURSE REVIEW CONTROLLERS ------

// Create course review
export const createCourseReview = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rating, comment, courseId } = req.body;
    const userId = req.user?._id;

    // Check if course exists
    const course = await CourseModel.findById(courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    // Check if user has already reviewed this course
    const existingReview = await CourseReviewModel.findOne({ courseId, userId });
    if (existingReview) {
      return next(new ErrorHandler("You have already reviewed this course", 400));
    }

    // Create new review
    const review = await CourseReviewModel.create({
      userId,
      courseId,
      rating,
      comment
    });

    // Update course rating
    const courseReviews = await CourseReviewModel.find({ courseId });
    
    // Calculate average rating
    const totalRating = courseReviews.reduce((sum, review) => sum + review.rating, 0);
    const avgRating = totalRating / courseReviews.length;
    
    // Update course with new rating
    await CourseModel.findByIdAndUpdate(courseId, { ratings: avgRating });

    // Clear redis cache
    await redis.del(`course:${courseId}`);

    res.status(201).json({
      success: true,
      review
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get all reviews for a course
export const getCourseReviews = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const courseId = req.params.courseId;

    // Check if course exists
    const course = await CourseModel.findById(courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    // Get all reviews for the course with user details
    const reviews = await CourseReviewModel.find({ courseId })
      .populate("userId", "name avatar")
      .populate("replies.user_id", "name avatar")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      reviews
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get all reviews for all courses owned by a mentor
export const getMentorCourseReviews = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mentorId = req.params.mentorId;

    // Check if mentor exists
    const mentor = await MentorModel.findById(mentorId);
    if (!mentor) {
      return next(new ErrorHandler("Mentor not found", 404));
    }

    // Find all courses owned by this mentor
    const courses = await CourseModel.find({ mentor: mentorId });
    
    if (courses.length === 0) {
      return res.status(200).json({
        success: true,
        reviews: []
      });
    }

    // Get course IDs
    const courseIds = courses.map(course => course._id);
    
    // Create a map of course IDs to course names for reference
    const courseMap: Record<string, string> = {};
    courses.forEach(course => {
      courseMap[course._id.toString()] = course.name;
    });

    // Get all reviews for these courses
    const reviews = await CourseReviewModel.find({ courseId: { $in: courseIds } })
      .populate("userId", "name avatar")
      .populate("replies.user_id", "name avatar")
      .sort({ createdAt: -1 });

    // Add course name to each review
    const reviewsWithCourseName = reviews.map(review => {
      const reviewObj: any = review.toObject();
      const courseIdStr = review.courseId.toString();
      reviewObj.courseName = courseMap[courseIdStr];
      return reviewObj;
    });

    res.status(200).json({
      success: true,
      reviews: reviewsWithCourseName
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Add reply to course review
export const addCourseReviewReply = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reviewId } = req.params;
    const { content } = req.body;
    const userId = req.user?._id;
    
    if (!content) {
      return next(new ErrorHandler("Content is required", 400));
    }

    const review = await CourseReviewModel.findById(reviewId);
    if (!review) {
      return next(new ErrorHandler("Review not found", 404));
    }

    const reply = {
      user_id: userId,
      content,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    review.replies.push(reply);
    await review.save();

    // Clear related cache
    await redis.del(`course:${review.courseId}`);

    res.status(201).json({
      success: true,
      review
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Update course review
export const updateCourseReview = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rating, comment } = req.body;
    const reviewId = req.params.id;
    const userId = req.user?._id;

    const review = await CourseReviewModel.findById(reviewId);
    if (!review) {
      return next(new ErrorHandler("Review not found", 404));
    }

    // Check if user is the reviewer
    if (review.userId.toString() !== userId.toString()) {
      return next(new ErrorHandler("You can only update your own reviews", 403));
    }

    // Update review
    review.rating = rating || review.rating;
    review.comment = comment || review.comment;
    await review.save();

    // Update course average rating
    const courseId = review.courseId;
    const courseReviews = await CourseReviewModel.find({ courseId });
    
    const totalRating = courseReviews.reduce((sum, review) => sum + review.rating, 0);
    const avgRating = totalRating / courseReviews.length;
    
    await CourseModel.findByIdAndUpdate(courseId, { ratings: avgRating });

    // Clear cache
    await redis.del(`course:${courseId}`);

    res.status(200).json({
      success: true,
      review
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Delete course review
export const deleteCourseReview = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reviewId = req.params.id;
    const userId = req.user?._id;
    const isAdmin = req.user?.role === "admin";

    const review = await CourseReviewModel.findById(reviewId);
    if (!review) {
      return next(new ErrorHandler("Review not found", 404));
    }

    // Check permission
    if (review.userId.toString() !== userId.toString() && !isAdmin) {
      return next(new ErrorHandler("You don't have permission to delete this review", 403));
    }

    const courseId = review.courseId;

    // Delete review
    await CourseReviewModel.findByIdAndDelete(reviewId);

    // Update course rating
    const courseReviews = await CourseReviewModel.find({ courseId });
    
    if (courseReviews.length > 0) {
      const totalRating = courseReviews.reduce((sum, review) => sum + review.rating, 0);
      const avgRating = totalRating / courseReviews.length;
      await CourseModel.findByIdAndUpdate(courseId, { ratings: avgRating });
    } else {
      await CourseModel.findByIdAndUpdate(courseId, { ratings: 0 });
    }

    // Clear cache
    await redis.del(`course:${courseId}`);

    res.status(200).json({
      success: true,
      message: "Review deleted successfully"
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// ------ MENTOR REVIEW CONTROLLERS ------

// Create mentor review
export const createMentorReview = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rating, comment, mentorId } = req.body;
    const userId = req.user?._id;

    // Check if mentor exists
    const mentor = await MentorModel.findById(mentorId);
    if (!mentor) {
      return next(new ErrorHandler("Mentor not found", 404));
    }

    // Check if user has already reviewed this mentor
    const existingReview = await MentorReviewModel.findOne({ mentorId, userId });
    if (existingReview) {
      return next(new ErrorHandler("You have already reviewed this mentor", 400));
    }

    // Create new review
    const review = await MentorReviewModel.create({
      userId,
      mentorId,
      rating,
      comment
    });

    // Update mentor rating
    const mentorReviews = await MentorReviewModel.find({ mentorId });
    
    // Calculate average rating
    const totalRating = mentorReviews.reduce((sum, review) => sum + review.rating, 0);
    const avgRating = totalRating / mentorReviews.length;
    
    // Update mentor with new rating
    await MentorModel.findByIdAndUpdate(mentorId, { averageRating: avgRating });

    // Clear redis cache
    await redis.del(`mentor:${mentorId}`);

    res.status(201).json({
      success: true,
      review
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get all reviews for a mentor
export const getMentorReviews = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mentorId = req.params.mentorId;

    // Check if mentor exists
    const mentor = await MentorModel.findById(mentorId);
    if (!mentor) {
      return next(new ErrorHandler("Mentor not found", 404));
    }

    // Get all reviews for the mentor with user details
    const reviews = await MentorReviewModel.find({ mentorId })
      .populate("userId", "name avatar")
      .populate("replies.user_id", "name avatar")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      reviews
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Add reply to mentor review
export const addMentorReviewReply = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reviewId } = req.params;
    const { content } = req.body;
    const userId = req.user?._id;
    
    if (!content) {
      return next(new ErrorHandler("Content is required", 400));
    }

    const review = await MentorReviewModel.findById(reviewId);
    if (!review) {
      return next(new ErrorHandler("Review not found", 404));
    }

    const reply = {
      user_id: userId,
      content,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    review.replies.push(reply);
    await review.save();

    // Clear related cache
    await redis.del(`mentor:${review.mentorId}`);

    res.status(201).json({
      success: true,
      review
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Update mentor review
export const updateMentorReview = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rating, comment } = req.body;
    const reviewId = req.params.id;
    const userId = req.user?._id;

    const review = await MentorReviewModel.findById(reviewId);
    if (!review) {
      return next(new ErrorHandler("Review not found", 404));
    }

    // Check if user is the reviewer
    if (review.userId.toString() !== userId.toString()) {
      return next(new ErrorHandler("You can only update your own reviews", 403));
    }

    // Update review
    review.rating = rating || review.rating;
    review.comment = comment || review.comment;
    await review.save();

    // Update mentor average rating
    const mentorId = review.mentorId;
    const mentorReviews = await MentorReviewModel.find({ mentorId });
    
    const totalRating = mentorReviews.reduce((sum, review) => sum + review.rating, 0);
    const avgRating = totalRating / mentorReviews.length;
    
    await MentorModel.findByIdAndUpdate(mentorId, { averageRating: avgRating });

    // Clear cache
    await redis.del(`mentor:${mentorId}`);

    res.status(200).json({
      success: true,
      review
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Delete mentor review
export const deleteMentorReview = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reviewId = req.params.id;
    const userId = req.user?._id;
    const isAdmin = req.user?.role === "admin";

    const review = await MentorReviewModel.findById(reviewId);
    if (!review) {
      return next(new ErrorHandler("Review not found", 404));
    }

    // Check permission
    if (review.userId.toString() !== userId.toString() && !isAdmin) {
      return next(new ErrorHandler("You don't have permission to delete this review", 403));
    }

    const mentorId = review.mentorId;

    // Delete review
    await MentorReviewModel.findByIdAndDelete(reviewId);

    // Update mentor rating
    const mentorReviews = await MentorReviewModel.find({ mentorId });
    
    if (mentorReviews.length > 0) {
      const totalRating = mentorReviews.reduce((sum, review) => sum + review.rating, 0);
      const avgRating = totalRating / mentorReviews.length;
      await MentorModel.findByIdAndUpdate(mentorId, { averageRating: avgRating });
    } else {
      await MentorModel.findByIdAndUpdate(mentorId, { averageRating: 0 });
    }

    // Clear cache
    await redis.del(`mentor:${mentorId}`);

    res.status(200).json({
      success: true,
      message: "Review deleted successfully"
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});