import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import cloudinary from "cloudinary";
import { createCourse, getAllCoursesService } from "../services/course.service";
import CourseModel, { IComment } from "../models/course.model";
import { redis } from "../utils/redis";
import mongoose from "mongoose";
import path from "path";
import ejs from "ejs";
import { sendMail } from "../utils/sendMail";
import NotificationModel from "../models/notification.Model";
import axios from "axios";
import jwt from 'jsonwebtoken';
import fs from 'fs';
import userModel from "../models/user.model";
import { emitNotification } from "../socketServer";

export const uploadCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
  //lấy file
      const files = req.files as Record<string, Express.Multer.File[]>;
      const image = files.image?.[0];
      const demo = files.demo?.[0];
      const videos = files.videos;
      const quizImages = files.quiz_images || [];

      console.log('[DEBUG-SERVER] Files nhận được:', Object.keys(files));
      console.log('[DEBUG-SERVER] Image:', image?.filename);
      console.log('[DEBUG-SERVER] Demo:', demo?.filename);
      console.log('[DEBUG-SERVER] Videos count:', videos?.length || 0);
      console.log(`[DEBUG-SERVER] Số lượng ảnh câu hỏi: ${quizImages.length}`);
      
      const course = JSON.parse(data.courseData);
      
      // Phân tích dữ liệu để lấy mapping giữa ảnh và câu hỏi
      interface ImageMapping {
        filename: string;
        contentIndex: number;
        quizzIndex: number;
      }
      
      const questionImageMapping: ImageMapping[] = [];
      if (course.courseData) {
        course.courseData.forEach((content: any, contentIndex: number) => {
          if (content.iquizz) {
            content.iquizz.forEach((quizz: any, quizzIndex: number) => {
              if (quizz.questionImage) {
                console.log(`[DEBUG-SERVER] Found questionImage in course data: section=${contentIndex}, quiz=${quizzIndex}, url=${quizz.questionImage.url}`);
                questionImageMapping.push({
                  filename: quizz.questionImage.url,
                  contentIndex,
                  quizzIndex
                });
              }
            });
          }
        });
      }
      
      console.log(`[DEBUG-SERVER] Created ${questionImageMapping.length} questionImageMappings`);
      
      course.thumbnail = {
        // public_id: image?.mimetype,
        url: image?.filename,
      };

      course.demoUrl = demo?.filename

      // Kiểm tra nếu có videos
      if (videos && videos.length > 0) {
        // Kiểm tra xem courseData có mảng không
        if (Array.isArray(course.courseData)) {
          // Duyệt qua từng phần tử trong courseData
          course.courseData.forEach((item: any, index: number) => {
            // Nếu tồn tại video tại vị trí tương ứng
            if (videos[index]) {
              // Gán filename của video vào videoUrl
              item.videoUrl = videos[index].filename;
            }
          });
        }
      }
      
      // Xử lý các file hình ảnh câu hỏi quiz
      if (quizImages.length > 0) {
        console.log('[DEBUG-SERVER] Bắt đầu xử lý ảnh câu hỏi');
        
        // Log all quiz images for debugging
        quizImages.forEach((imageFile, index) => {
          console.log(`[DEBUG-SERVER] Quiz image ${index}: filename=${imageFile.filename}, originalname=${imageFile.originalname}`);
        });
        
        // Ghép ảnh với vị trí câu hỏi dựa trên filename
        quizImages.forEach((imageFile, index) => {
          // Tìm index của section và quiz để gán ảnh
          if (questionImageMapping.length > index) {
            const mappingInfo = questionImageMapping[index];
            const { contentIndex, quizzIndex } = mappingInfo;
            console.log(`[DEBUG-SERVER] Gán ảnh ${imageFile.filename} cho câu hỏi: section=${contentIndex}, quiz=${quizzIndex}`);
            
            // Kiểm tra và xóa ảnh cũ nếu có
            const courseDataItem = course.courseData[contentIndex];
            if (courseDataItem && 
                courseDataItem.iquizz && 
                courseDataItem.iquizz[quizzIndex] && 
                courseDataItem.iquizz[quizzIndex].questionImage?.url) {
              const oldImagePath = path.join(__dirname, '../uploads/images', courseDataItem.iquizz[quizzIndex].questionImage.url);
              console.log(`[DEBUG-SERVER] Tìm thấy ảnh cũ: ${oldImagePath}`);
              
              if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
                console.log('[DEBUG-SERVER] Đã xóa ảnh câu hỏi cũ:', oldImagePath);
              }
            }
            
            if (course.courseData[contentIndex] && 
                course.courseData[contentIndex].iquizz && 
                course.courseData[contentIndex].iquizz[quizzIndex]) {
              
              // Cập nhật thông tin hình ảnh cho câu hỏi
              course.courseData[contentIndex].iquizz[quizzIndex].questionImage = {
                url: imageFile.filename
              };
              
              console.log(`[DEBUG-SERVER] Đã cập nhật questionImage cho câu hỏi`);
            }
          } else {
            console.log(`[DEBUG-SERVER] Không tìm thấy mapping cho ảnh ${imageFile.filename}, index=${index}, mappingLength=${questionImageMapping.length}`);
          }
        });
      } else {
        console.log('[DEBUG-SERVER] Không có ảnh câu hỏi để xử lý');
      }

      console.log(course.thumbnail);
      createCourse(course, res, next);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);


export const editCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await userModel.findById(req.user?._id);
      console.log(req.user?._id)
      const files = req.files as Record<string, Express.Multer.File[]>;
      const courseId = req.params.id;
      let videoIndex = 0;
      const coursedb = await CourseModel.findById(courseId) as any;

      if (!coursedb) {
        return next(new ErrorHandler("Course not found", 404));
      }

      const data = req.body;
      const image = files.imageedit?.[0];
      const demo = files.demoedit?.[0];
      const videos = files.videos || [];
      const quizImages = files.quiz_images || [];

      console.log('[DEBUG-SERVER-EDIT] Files nhận được:', Object.keys(files));
      console.log('[DEBUG-SERVER-EDIT] Image:', image?.filename);
      console.log('[DEBUG-SERVER-EDIT] Demo:', demo?.filename);
      console.log('[DEBUG-SERVER-EDIT] Videos count:', videos?.length);
      console.log(`[DEBUG-SERVER-EDIT] Số lượng ảnh câu hỏi: ${quizImages.length}`);

      const courses = JSON.parse(data.courseData);

      // Phân tích dữ liệu để lấy mapping giữa ảnh và câu hỏi
      interface ImageMapping {
        filename: string;
        contentIndex: number;
        quizzIndex: number;
        uniqueId?: string; // Adding uniqueId for better identification
      }
      
      const questionImageMapping: ImageMapping[] = [];
      if (courses.courseData) {
        courses.courseData.forEach((content: any, contentIndex: number) => {
          if (content.iquizz) {
            content.iquizz.forEach((quizz: any, quizzIndex: number) => {
              if (quizz.questionImage) {
                console.log(`[DEBUG-SERVER-EDIT] Found questionImage in course data: section=${contentIndex}, quiz=${quizzIndex}, url=${quizz.questionImage.url}`);
                // Create a uniqueId from contentIndex and quizzIndex to ensure correct mapping
                const uniqueId = `${contentIndex}_${quizzIndex}`;
                questionImageMapping.push({
                  filename: quizz.questionImage.url,
                  contentIndex,
                  quizzIndex,
                  uniqueId
                });
              }
            });
          }
        });
      }
      
      console.log(`[DEBUG-SERVER-EDIT] Created ${questionImageMapping.length} questionImageMappings`);

      if (image && coursedb.thumbnail?.url) {
        const oldImagePath = path.join(__dirname, '../uploads/images', coursedb.thumbnail.url);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
          console.log('Đã xóa ảnh cũ:', oldImagePath);
        }
        courses.thumbnail = {
          url: image?.filename,
        };
      }

      if (demo && coursedb.demoUrl) {
        const oldDemoPath = path.join(__dirname, '../uploads/videos', coursedb.demoUrl);
        if (fs.existsSync(oldDemoPath)) {
          fs.unlinkSync(oldDemoPath);
          console.log('Đã xóa demo cũ:', oldDemoPath);
        }
        courses.demoUrl = demo.filename;
      }

      if (videos && videos.length > 0) {
        const validVideos = videos.filter(video => video);

        if (courses.courseData && coursedb.courseData) {
          courses.courseData.forEach((content: any, index: number) => {
            const courseDataItem = coursedb.courseData[index];
            if (courseDataItem && content.videoUrl === courseDataItem._id?.toString()) {
              const oldVideoUrl = courseDataItem.videoUrl;
              if (oldVideoUrl) {
                const oldVideoPath = path.join(__dirname, '../uploads/videos', oldVideoUrl);
                if (fs.existsSync(oldVideoPath)) {
                  fs.unlinkSync(oldVideoPath);
                  console.log('Đã xóa video cũ:', oldVideoPath);
                }
              }
              if (validVideos[videoIndex]) {
                content.videoUrl = validVideos[videoIndex].filename;
                videoIndex++;
              }
            }
          });
        }
      }

      // Giữ lại _id cho từng phần tử trong courseData
      if (courses.courseData && coursedb.courseData) {
        courses.courseData.forEach((content: any, index: number) => {
          // Nếu có ID trong dữ liệu gốc và index hợp lệ, giữ nguyên ID đó
          if (index < coursedb.courseData.length) {
            content._id = coursedb.courseData[index]._id;
          }
        });
      }
      
      // Xử lý các file hình ảnh câu hỏi quiz
      if (quizImages.length > 0) {
        console.log('[DEBUG-SERVER-EDIT] Bắt đầu xử lý ảnh câu hỏi');
        
        // Log all quiz images for debugging
        quizImages.forEach((imageFile, index) => {
          console.log(`[DEBUG-SERVER-EDIT] Quiz image ${index}: filename=${imageFile.filename}, originalname=${imageFile.originalname}, fieldname=${imageFile.fieldname}`);
          
          // Đảm bảo filename bắt đầu bằng "quiz_images"
          if (!imageFile.filename.startsWith('quiz_images')) {
            const oldPath = path.join(__dirname, '../uploads/images', imageFile.filename);
            const newFilename = `quiz_images_${imageFile.filename}`;
            const newPath = path.join(__dirname, '../uploads/images', newFilename);
            
            try {
              // Đổi tên file để bắt đầu bằng "quiz_images"
              if (fs.existsSync(oldPath)) {
                fs.renameSync(oldPath, newPath);
                console.log(`[DEBUG-SERVER-EDIT] Đã đổi tên file từ ${imageFile.filename} thành ${newFilename}`);
                imageFile.filename = newFilename;
              }
            } catch (err) {
              console.error(`[DEBUG-SERVER-EDIT] Lỗi khi đổi tên file: ${err}`);
            }
          }
        });
        
        // Ghép ảnh với vị trí câu hỏi dựa trên filename và vị trí
        quizImages.forEach((imageFile, index) => {
          // Check if this image has a uniqueId in its fieldname or originalname
          const filenameParts = imageFile.originalname.split('__');
          const fieldnameParts = imageFile.fieldname.split('__');
          
          // Try to find uniqueId from filename or fallback to index-based mapping
          let uniqueId = '';
          if (filenameParts.length > 1) {
            uniqueId = filenameParts[0]; // The uniqueId is now the first part before __
            console.log(`[DEBUG-SERVER-EDIT] Found uniqueId ${uniqueId} in originalname`);
          } else if (fieldnameParts.length > 1) {
            uniqueId = fieldnameParts[fieldnameParts.length - 1];
            console.log(`[DEBUG-SERVER-EDIT] Found uniqueId ${uniqueId} in fieldname`);
          }
          
          // Find the mapping by uniqueId or index
          let mappingInfo;
          if (uniqueId) {
            mappingInfo = questionImageMapping.find(m => m.uniqueId === uniqueId);
            if (mappingInfo) {
              console.log(`[DEBUG-SERVER-EDIT] Found mapping by uniqueId: ${uniqueId}`);
            }
          }
          
          // Fallback to index-based mapping if uniqueId matching failed
          if (!mappingInfo && questionImageMapping.length > index) {
            mappingInfo = questionImageMapping[index];
            console.log(`[DEBUG-SERVER-EDIT] Using index-based mapping for image ${index}`);
          }
          
          if (mappingInfo) {
            const { contentIndex, quizzIndex } = mappingInfo;
            console.log(`[DEBUG-SERVER-EDIT] Gán ảnh ${imageFile.filename} cho câu hỏi: section=${contentIndex}, quiz=${quizzIndex}`);
            
            // Kiểm tra và xóa ảnh cũ nếu có
            const courseDataItem = coursedb.courseData[contentIndex];
            if (courseDataItem && 
                courseDataItem.iquizz && 
                courseDataItem.iquizz[quizzIndex] && 
                courseDataItem.iquizz[quizzIndex].questionImage?.url) {
              const oldImagePath = path.join(__dirname, '../uploads/images', courseDataItem.iquizz[quizzIndex].questionImage.url);
              console.log(`[DEBUG-SERVER-EDIT] Tìm thấy ảnh cũ: ${oldImagePath}`);
              
              if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
                console.log('[DEBUG-SERVER-EDIT] Đã xóa ảnh câu hỏi cũ:', oldImagePath);
              }
            }
            
            if (courses.courseData[contentIndex] && 
                courses.courseData[contentIndex].iquizz && 
                courses.courseData[contentIndex].iquizz[quizzIndex]) {
              
              // Cập nhật thông tin hình ảnh cho câu hỏi
              courses.courseData[contentIndex].iquizz[quizzIndex].questionImage = {
                url: imageFile.filename
              };
              
              console.log(`[DEBUG-SERVER-EDIT] Đã cập nhật questionImage cho câu hỏi`);
            }
          } else {
            console.log(`[DEBUG-SERVER-EDIT] Không tìm thấy mapping cho ảnh ${imageFile.filename}, index=${index}, mappingLength=${questionImageMapping.length}`);
          }
        });
      } else {
        console.log('[DEBUG-SERVER-EDIT] Không có ảnh câu hỏi để xử lý');
      }

      const course = await CourseModel.findByIdAndUpdate(
        courseId,
        {
          $set: courses,
        },
        { new: true }
      );

    

      res.status(201).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

export const getSingleCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = req.params.id;

      const isCacheExist = await redis.get(courseId);
      //check xem đã tồn tại dữ liệu trong redis chưa; xoá cache để tối ưu hoá
      if (isCacheExist) {
        const course = JSON.parse(isCacheExist);
        res.status(200).json({
          success: true,
          course,
        });
      } else {// lấy dữ liệu khoá học
        const course = await CourseModel.findById(req.params.id).select(
          "-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links"
        );

        await redis.set(courseId, JSON.stringify(course), "EX", 604800); // 7days

        res.status(200).json({
          success: true,
          course,
        });
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

export const getAllCourses = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isNext = req.query.isNext === "true" ? true : false;

      const courses = await CourseModel.find({ status: "active" }).select(
        "-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links"
      );

      res.status(200).json({
        success: true,
        courses,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);


export const getCourseByUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // const userCourseList = req.user?.courses;
      const courseId = req.params.id;
  
      // const courseExists = userCourseList?.find(
      //   (course: any) => course._id.toString() === courseId
      // );

      // if (!courseExists) {
      //   return next(
      //     new ErrorHandler("Bạn không đủ điều kiện để tham gia khóa học này", 404)
      //   );
      // }

      const course = await CourseModel.findById(courseId);

      const content = course?.courseData;

      res.status(200).json({
        success: true,
        content,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

//type question data
interface IAddQuestionData {
  question: string;
  courseId: string;
  contentId: string;
}

export const addQuestion = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { question, courseId, contentId }: IAddQuestionData = req.body;

      const course = await CourseModel.findById(courseId);

      if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return next(new ErrorHandler("Id nội dung không hợp lệ", 400));
      }

      const couseContent = course?.courseData?.find((item: any) =>
        item._id.equals(contentId)
      );//tìm bài học theo khoá học xem có tồn tại hay chưa

      if (!couseContent) {
        return next(new ErrorHandler("Id nội dung không hợp lệ", 400));
      }

      // Tạo một đối tượng câu hỏi mới
      const newQuestion: any = {
        user: req.user,
        question,
        questionReplies: [],
      };

      // Thêm câu hỏi này vào nội dung khóa học của chúng tôi
      couseContent.questions.push(newQuestion);
     
      const notification = await NotificationModel.create({
        user: req.user?._id,
        title: "Câu hỏi mới nhận được",
        message: `Bạn có một câu hỏi mới trong bài học ${couseContent.title} của khóa học ${course?.name}`,
      });

      // Emit socket notification
      emitNotification(notification);

      // Lưu khóa học cập nhật
      await course?.save();

      res.status(200).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Thêm câu trả lời trong câu hỏi khóa học
interface IAddAnswerData {
  answer: string;
  courseId: string;
  contentId: string;
  questionId: string;
}

export const addAnwser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { answer, courseId, contentId, questionId }: IAddAnswerData =
        req.body;

      const course = await CourseModel.findById(courseId);

      if (!mongoose.Types.ObjectId.isValid(contentId)) {
        return next(new ErrorHandler("Id nội dung không hợp lệ", 400));
      }

      const couseContent = course?.courseData?.find((item: any) =>
        item._id.equals(contentId)
      );

      if (!couseContent) {
        return next(new ErrorHandler("Id nội dung không hợp lệ", 400));
      }

      const question = couseContent?.questions?.find((item: any) =>
        item._id.equals(questionId)
      );

      if (!question) {
        return next(new ErrorHandler("ID câu hỏi không hợp lệ", 400));
      }

      // Tạo đối tượng trả lời mới
      const newAnswer: any = {
        user: req.user,
        answer,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Thêm câu trả lời này vào nội dung khóa học của chúng tôi
      question.questionReplies.push(newAnswer);

      await course?.save();

      if (req.user?._id === question.user._id) {
        // Tạo thông báo
        const notification = await NotificationModel.create({
          user: req.user?._id,
          title: "Đã nhận được câu trả lời câu hỏi mới",
          message: `Bạn có câu trả lời câu hỏi mới trong bài học ${couseContent.title}của khóa học ${course?.name}`,
        });
        // Emit socket notification
        emitNotification(notification);
      } else {
        const data = {
          name: question.user.name,
          title: couseContent.title,
        };

        const html = await ejs.renderFile(
          path.join(__dirname, "../mails/question-reply.ejs"),
          data
        );

        try {
          await sendMail({
            email: question.user.email,
            subject: "Question Reply",
            template: "question-reply.ejs",
            data,
          });
        } catch (error: any) {
          return next(new ErrorHandler(error.message, 500));
        }
      }

      res.status(200).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Thêm đánh giá trong khóa học
interface IAddReviewData {
  review: string;
  rating: number;
  userId: string;
}

export const addReview = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userCourseList = req.user?.courses;
      const courseId = req.params.id;

      const courseExists = userCourseList?.some(
        (course: any) => course._id.toString() === courseId.toString()
      );

      if (!courseExists) {
        return next(
          new ErrorHandler("Bạn không đủ điều kiện để tham gia khóa học này", 404)
        );
      }

      const course = await CourseModel.findById(courseId);

      const { review, rating } = req.body as IAddReviewData;

      const reviewData: any = {
        user: req.user,
        rating,
        comment: review,
      };

      course?.reviews.push(reviewData);
      let avg = 0;
      
      course?.reviews.forEach((rev: any) => {
        avg += rev.rating;
      });

      if (course) {
        course.ratings = avg / course.reviews.length;
      }

      await course?.save();
      await redis.set(courseId, JSON.stringify(course), "EX", 604800);

      // Tạo notification
      const notification = await NotificationModel.create({
        user: req.user?._id,
        title: "Nhận được đánh giá mới",
        message: `${req.user?.name} đã đưa ra đánh giá trong ${course?.name}`,
      });

      // Emit socket notification
      emitNotification(notification);

      res.status(200).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);


interface IAddReviewData {
  comment: string;
  courseId: string;
  reviewId: string;
}
export const addReplyToReview = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { comment, courseId, reviewId } = req.body as IAddReviewData;

      const course = await CourseModel.findById(courseId);

      if (!course) {
        return next(new ErrorHandler("Không tìm thấy khóa học", 404));
      }
      // tìm kiếm đánh giá
      const review = course?.reviews?.find(
        (rev: any) => rev._id.toString() === reviewId
      );

      if (!review) {
        return next(new ErrorHandler("Không tìm thấy đánh giá", 404));
      }

      const replyData: any = {
        user: req.user,
        comment,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (!review.commentReplies) {
        review.commentReplies = [];
      }

      review.commentReplies?.push(replyData);

      await course?.save();

      await redis.set(courseId, JSON.stringify(course), "EX", 604800); // 7days

      res.status(200).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);


export const getAdminAllCourses = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      getAllCoursesService(res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


export const deleteCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const course = await CourseModel.findById(id);

      if (!course) {
        return next(new ErrorHandler("không tìm thấy khóa học", 404));
      }

      // Tìm mentor sở hữu khóa học và xóa khóa học khỏi danh sách courses của mentor
      if (course.mentor) {
        const mentor = await mongoose.model("Mentor").findById(course.mentor);
        if (mentor) {
          // Xóa khóa học khỏi danh sách courses của mentor
          mentor.courses = mentor.courses.filter(
            (courseId: mongoose.Types.ObjectId) => courseId.toString() !== id
          );
          await mentor.save();
        }
      }

      await course.deleteOne({ id });

      await redis.del(id);

      res.status(200).json({
        success: true,
        message: "Khóa học đã xóa thành công",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Mentor tạo khóa học mới (status: draft)
export const createCourseDraft = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log('CourseDrafffffffffffffffffffffffffffff')
      const userId = req.user?._id;
      if (!userId) {
        return next(new ErrorHandler("Vui lòng đăng nhập", 400));
      }

      // Kiểm tra xem user có phải là mentor không
      const user = await userModel.findById(userId);
      if (!user || user.role !== "mentor") {
        return next(new ErrorHandler("Chỉ mentor mới có thể tạo khóa học", 403));
      }

      // Tìm mentor ID từ user ID
      const mentor = await mongoose.model("Mentor").findOne({ user: userId });
      if (!mentor) {
        return next(new ErrorHandler("Không tìm thấy thông tin mentor", 404));
      }

      const data = req.body;
      const files = req.files as Record<string, Express.Multer.File[]>;
      
      // Debug raw file input
      console.log('[DEBUG-FILES] File keys received:', Object.keys(files));
      for (const key in files) {
        console.log(`[DEBUG-FILES] ${key} count: ${files[key].length}`);
        files[key].forEach((file, index) => {
          console.log(`[DEBUG-FILES] ${key}[${index}]:`, file.fieldname, file.originalname, file.mimetype);
        });
      }
      
      const image = files.image?.[0];
      const demo = files.demo?.[0];
      const videos = files.videos;
      const quizImages = files.quiz_images || [];

      console.log('[DEBUG-DRAFT] Files nhận được:', Object.keys(files));
      console.log('[DEBUG-DRAFT] Image:', image?.filename);
      console.log('[DEBUG-DRAFT] Demo:', demo?.filename);
      console.log('[DEBUG-DRAFT] Videos count:', videos?.length || 0);
      console.log(`[DEBUG-DRAFT] Số lượng ảnh câu hỏi: ${quizImages.length}`);
      
      const course = JSON.parse(data.courseData);
      
      // Thêm thông tin mentor và status
      course.mentor = mentor._id;
      course.status = "draft"; // mặc định là draft

      // Phân tích dữ liệu để lấy mapping giữa ảnh và câu hỏi
      interface ImageMapping {
        filename: string;
        contentIndex: number;
        quizzIndex: number;
      }
      
      const questionImageMapping: ImageMapping[] = [];
      if (course.courseData) {
        course.courseData.forEach((content: any, contentIndex: number) => {
          if (content.iquizz) {
            content.iquizz.forEach((quizz: any, quizzIndex: number) => {
              if (quizz.questionImage) {
                console.log(`[DEBUG-DRAFT] Found questionImage in course data: section=${contentIndex}, quiz=${quizzIndex}, url=${quizz.questionImage.url}`);
                questionImageMapping.push({
                  filename: quizz.questionImage.url,
                  contentIndex,
                  quizzIndex
                });
              }
            });
          }
        });
      }
      
      console.log(`[DEBUG-DRAFT] Created ${questionImageMapping.length} questionImageMappings`);

      course.thumbnail = {
        url: image?.filename,
      };

      course.demoUrl = demo?.filename;

      // Kiểm tra nếu có videos
      if (videos && videos.length > 0) {
        // Kiểm tra xem courseData có mảng không
        if (Array.isArray(course.courseData)) {
          // Duyệt qua từng phần tử trong courseData
          course.courseData.forEach((item: any, index: number) => {
            // Nếu tồn tại video tại vị trí tương ứng
            if (videos[index]) {
              // Gán filename của video vào videoUrl
              item.videoUrl = videos[index].filename;
            }
          });
        }
      }
      
      // Xử lý các file hình ảnh câu hỏi quiz
      if (quizImages.length > 0) {
        console.log('[DEBUG-DRAFT] Bắt đầu xử lý ảnh câu hỏi');
        
        // Log all quiz images for debugging
        quizImages.forEach((imageFile, index) => {
          console.log(`[DEBUG-DRAFT] Quiz image ${index}: filename=${imageFile.filename}, originalname=${imageFile.originalname}, fieldname=${imageFile.fieldname}`);
        });
        
        // Ghép ảnh với vị trí câu hỏi dựa trên filename - alternative approach
        if (questionImageMapping.length > 0) {
          quizImages.forEach((imageFile, index) => {
            if (index < questionImageMapping.length) {
              const mappingInfo = questionImageMapping[index];
              const { contentIndex, quizzIndex } = mappingInfo;
              
              if (course.courseData[contentIndex] && 
                  course.courseData[contentIndex].iquizz && 
                  course.courseData[contentIndex].iquizz[quizzIndex]) {
                
                course.courseData[contentIndex].iquizz[quizzIndex].questionImage = {
                  url: imageFile.filename
                };
                
                console.log(`[DEBUG-DRAFT] Mapped image ${imageFile.filename} to question at section=${contentIndex}, quiz=${quizzIndex}`);
              }
            }
          });
        } else {
          console.log('[DEBUG-DRAFT] No question image mappings found, even though images were uploaded');
        }
      } else {
        console.log('[DEBUG-DRAFT] Không có ảnh câu hỏi để xử lý');
      }

      const newCourse = await CourseModel.create(course);

      // Thêm khóa học vào danh sách khóa học của mentor
      mentor.courses.push(newCourse._id);
      await mentor.save();

      res.status(201).json({
        success: true,
        course: newCourse
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);
// Mentor gửi khóa học để duyệt
export const submitCourseForApproval = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId } = req.params;
      const userId = req.user?._id;

      if (!userId) {
        return next(new ErrorHandler("Vui lòng đăng nhập", 400));
      }

      // Tìm khóa học
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Không tìm thấy khóa học", 404));
      }

      // Tìm mentor ID từ user ID
      const mentor = await mongoose.model("Mentor").findOne({ user: userId });
      if (!mentor) {
        return next(new ErrorHandler("Không tìm thấy thông tin mentor", 404));
      }

      // Kiểm tra xem khóa học có thuộc về mentor không
      if (course.mentor?.toString() !== mentor._id.toString()) {
        return next(new ErrorHandler("Bạn không có quyền cập nhật khóa học này", 403));
      }

      // Cập nhật trạng thái thành pending
      course.status = "pending";
      await course.save();

      // Tạo thông báo cho admin
      const notification = await NotificationModel.create({
        title: "Khóa học mới cần phê duyệt",
        message: `Mentor đã gửi khóa học "${course.name}" để phê duyệt.`,
        status: "unread"
      });
      emitNotification(notification);

      res.status(200).json({
        success: true,
        message: "Khóa học đã được gửi để phê duyệt"
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Admin phê duyệt hoặc từ chối khóa học
export const updateCourseStatus = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId, status, reason } = req.body;
      
      if (!["pending", "active", "rejected"].includes(status)) {
        return next(new ErrorHandler("Trạng thái không hợp lệ", 400));
      }

      // Tìm khóa học
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Không tìm thấy khóa học", 404));
      }

      // Cập nhật trạng thái khóa học
      course.status = status;
      await course.save();

      // Xóa cache Redis nếu có
      await redis.del(courseId);

      // Tìm mentor của khóa học
      const mentor = await mongoose.model("Mentor").findById(course.mentor);
      if (mentor) {
        const user = await userModel.findById(mentor.user);
        
        if (user) {
          // Gửi email thông báo cho mentor
          if (status === "active") {
            await sendMail({
              email: user.email,
              subject: "Khóa học của bạn đã được phê duyệt",
              template: "course-approved.ejs",
              data: {
                user: {
                  name: user.name
                },
                course: {
                  name: course.name
                }
              }
            });
          } else if (status === "rejected" && reason) {
            await sendMail({
              email: user.email,
              subject: "Khóa học của bạn đã bị từ chối",
              template: "course-rejected.ejs",
              data: {
                user: {
                  name: user.name
                },
                course: {
                  name: course.name
                },
                reason
              }
            });
          }
        }
      }

      res.status(200).json({
        success: true,
        message: `Khóa học đã được ${status === "active" ? "phê duyệt" : "từ chối"}`
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Lấy danh sách khóa học đang chờ phê duyệt
export const getPendingCourses = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pendingCourses = await CourseModel.find({ status: "pending" })
        .populate({
          path: "mentor",
          select: "_id bio experience",
          populate: {
            path: "user",
            select: "name email avatar"
          }
        });

      res.status(200).json({
        success: true,
        pendingCourses
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);



