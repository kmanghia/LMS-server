import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CourseModel from '../models/course.model';
import MentorModel from '../models/mentor.model';
import CourseReviewModel from '../models/review_courses.model';
import MentorReviewModel from '../models/review_mentors.model';

dotenv.config();

// Connect to MongoDB
const connectDatabase = async () => {
  try {
    await mongoose.connect(process.env.DB_URL || '');
    console.log('MongoDB connected successfully');
  } catch (error: any) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Migrate course reviews
const migrateCourseReviews = async () => {
  try {
    console.log('Starting course reviews migration...');
    
    // Get all courses with reviews
    const courses = await mongoose.connection.db.collection('courses').find({}).toArray();
    let totalReviews = 0;
    let migratedReviews = 0;
    
    for (const course of courses) {
      if (course.reviews && course.reviews.length > 0) {
        for (const review of course.reviews) {
          totalReviews++;
          
          try {
            // Check if review already exists
            const existingReview = await CourseReviewModel.findOne({
              courseId: course._id,
              userId: review.user._id
            });
            
            if (!existingReview) {
              // Create new review in separate collection
              const newReview = new CourseReviewModel({
                courseId: course._id,
                userId: review.user._id,
                rating: review.rating || 0,
                comment: review.comment || '',
                replies: review.commentReplies ? review.commentReplies.map((reply: any) => ({
                  user_id: reply.user._id,
                  content: reply.comment || '',
                  createdAt: reply.createdAt || new Date(),
                  updatedAt: reply.updatedAt || new Date()
                })) : [],
                createdAt: review.createdAt || new Date(),
                updatedAt: review.updatedAt || new Date()
              });
              
              await newReview.save();
              migratedReviews++;
            }
          } catch (err: any) {
            console.error(`Error migrating course review: ${err.message}`);
          }
        }
      }
    }
    
    console.log(`Course reviews migration completed: ${migratedReviews} of ${totalReviews} reviews migrated`);
  } catch (error: any) {
    console.error(`Course reviews migration failed: ${error.message}`);
  }
};

// Migrate mentor reviews
const migrateMentorReviews = async () => {
  try {
    console.log('Starting mentor reviews migration...');
    
    // Get all mentors with reviews
    const mentors = await mongoose.connection.db.collection('mentors').find({}).toArray();
    let totalReviews = 0;
    let migratedReviews = 0;
    
    for (const mentor of mentors) {
      if (mentor.reviews && mentor.reviews.length > 0) {
        for (const review of mentor.reviews) {
          totalReviews++;
          
          try {
            // Check if review already exists
            const existingReview = await MentorReviewModel.findOne({
              mentorId: mentor._id,
              userId: review.user._id || review.user
            });
            
            if (!existingReview) {
              // Create new review in separate collection
              const newReview = new MentorReviewModel({
                mentorId: mentor._id,
                userId: review.user._id || review.user,
                rating: review.rating || 0,
                comment: review.comment || '',
                createdAt: review.createdAt || new Date(),
                updatedAt: new Date()
              });
              
              await newReview.save();
              migratedReviews++;
            }
          } catch (err: any) {
            console.error(`Error migrating mentor review: ${err.message}`);
          }
        }
      }
    }
    
    console.log(`Mentor reviews migration completed: ${migratedReviews} of ${totalReviews} reviews migrated`);
  } catch (error: any) {
    console.error(`Mentor reviews migration failed: ${error.message}`);
  }
};

// Main migration function
const migrateReviews = async () => {
  await connectDatabase();
  
  try {
    await migrateCourseReviews();
    await migrateMentorReviews();
    
    console.log('Review migration completed successfully');
  } catch (error: any) {
    console.error(`Migration failed: ${error.message}`);
  } finally {
    mongoose.disconnect();
    console.log('Database disconnected');
  }
};

// Run the migration
migrateReviews(); 