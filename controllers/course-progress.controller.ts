import { Request, Response, NextFunction } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import userModel from "../models/user.model";
import CourseModel from "../models/course.model";
import OrderModel from "../models/order.Model";

// Get user's latest active course with progress and notes
export const getLatestPurchasedCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      
      // Get the user with their progress data
      const user = await userModel.findById(userId);
      
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }
      
      // Get all purchased courses for this user
      const orders = await OrderModel.find({ userId }).sort({ createdAt: -1 });
      
      if (orders.length === 0) {
        return next(new ErrorHandler("No purchased courses found", 404));
      }

      // Extract all course IDs from orders
      const purchasedCourseIds = orders.map(order => order.courseId);
      
      let selectedCourseId = null;
      
      // Lưu trữ tất cả các khóa học có lastActivityAt
      let coursesWithActivityAt = [];
      
      // In ra toàn bộ dữ liệu progress để debug
      console.log("========================");
      console.log("KIỂM TRA DỮ LIỆU PROGRESS");
      console.log("========================");
      
      if (user.progress && Array.isArray(user.progress)) {
        // Duyệt qua tất cả progress
        for (let i = 0; i < user.progress.length; i++) {
          const progress = user.progress[i];
          console.log(`Progress ${i} - courseId: ${progress.courseId}`);
          
          if (progress.chapters && Array.isArray(progress.chapters)) {
            // Duyệt qua từng chapter
            for (let j = 0; j < progress.chapters.length; j++) {
              const chapter = progress.chapters[j];
              console.log(`  Chapter ${j} - chapterId: ${chapter.chapterId}`);
              
              // Kiểm tra xem lastActivityAt có tồn tại không
              if (chapter.lastActivityAt) {
                console.log(`  --> Có lastActivityAt: ${chapter.lastActivityAt}`);
                
                // Lưu lại thông tin khóa học và thời gian
                coursesWithActivityAt.push({
                  courseId: progress.courseId,
                  time: chapter.lastActivityAt,
                  timeMs: new Date(String(chapter.lastActivityAt)).getTime()
                });
                
                // Chỉ cần tìm thấy 1 chapter có lastActivityAt trong một khóa học là đủ
                break;
              }
            }
          }
        }
      }
      
      console.log("Các khóa học có lastActivityAt:", JSON.stringify(coursesWithActivityAt));
      
      if (coursesWithActivityAt.length > 0) {
        // Sắp xếp theo thời gian giảm dần (mới nhất lên đầu)
        coursesWithActivityAt.sort((a, b) => b.timeMs - a.timeMs);
        
        console.log("Các khóa học đã sắp xếp:", JSON.stringify(coursesWithActivityAt));
        
        // Lấy khóa học có thời gian mới nhất
        selectedCourseId = coursesWithActivityAt[0].courseId;
        console.log(`Đã chọn khóa học theo lastActivityAt: ${selectedCourseId} (${coursesWithActivityAt[0].time})`);
      } else {
        console.log("Không tìm thấy khóa học nào có lastActivityAt");
        
        // Nếu không có khóa học nào có lastActivityAt, lấy khóa học mới mua nhất
        selectedCourseId = orders[0].courseId;
        console.log(`Đã chọn khóa học mới mua nhất: ${selectedCourseId}`);
      }
      
      console.log(`Khóa học cuối cùng được chọn: ${selectedCourseId}`);
      
      // Get the course details
      const course = await CourseModel.findById(selectedCourseId);
      
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }
      
      // Find course progress
      const courseProgress = user.progress?.find(
        (item) => item.courseId === selectedCourseId
      );
      
      // Calculate progress percentage
      let progressPercentage = 0;
      if (courseProgress) {
        const completedChapters = courseProgress.chapters.filter(
          (chapter) => chapter.isCompleted
        ).length;
        
        const totalChapters = course.courseData.length;
        progressPercentage = totalChapters > 0 
          ? Math.round((completedChapters / totalChapters) * 100) 
          : 0;
      }
      
      // Find course notes
      const courseNotes = user.notes?.filter(
        (item) => item.courseId === selectedCourseId
      ) || [];
      
      const totalNotes = courseNotes.reduce((sum, noteGroup) => {
        return sum + (noteGroup.note?.length || 0);
      }, 0);
      
      const courseData = {
        _id: course._id,
        name: course.name,
        description: course.description,
        thumbnail: course.thumbnail,
        progress: progressPercentage,
        totalNotes: totalNotes,
        totalChapters: course.courseData.length
      };
      
      res.status(200).json({
        success: true,
        course: courseData
      });
      
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);