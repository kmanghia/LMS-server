import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import MentorModel, { IMentor } from "../models/mentor.model";
import userModel from "../models/user.model";
import CourseModel from "../models/course.model";
import { redis } from "../utils/redis";
import mongoose from "mongoose";
import NotificationModel from "../models/notification.Model";
import path from "path";
import ejs from "ejs";
import { sendMail } from "../utils/sendMail";
import jwt from "jsonwebtoken";
import { sendToken } from "../utils/jwt";

// Đăng ký làm mentor
interface IRegisterMentorRequest {
  name?: string;
  email?: string;
  password?: string;
  bio: string;
  specialization: string[];
  experience: number;
  achievements: string[];
  isNewUser?: boolean;
}

export const registerAsMentor = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { 
        name, 
        email, 
        password, 
        bio, 
        specialization, 
        experience, 
        achievements, 
        isNewUser 
      } = req.body as IRegisterMentorRequest;
      
      let userId;

      // Kiểm tra xem đây có phải là đăng ký mới hoàn toàn hay không
      if (isNewUser) {
        // Xác thực các trường bắt buộc cho người dùng mới
        if (!name || !email || !password) {
          return next(new ErrorHandler("Vui lòng điền đầy đủ thông tin cá nhân", 400));
        }

        // Kiểm tra email đã tồn tại chưa
        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
          return next(new ErrorHandler("Email đã được sử dụng", 400));
        }

        // Tạo người dùng mới
        const user = await userModel.create({
          name,
          email,
          password,
          role: "mentor"
        });

        userId = user._id;

        // Gửi email xác nhận đăng ký
        const activationToken = createActivationToken(user);
        const activationCode = activationToken.activationCode;
        const data = { user: { name: user.name }, activationCode };
        
        try {
          await sendMail({
            email: user.email,
            subject: "Kích hoạt tài khoản",
            template: "activation-mail.ejs",
            data,
          });
        } catch (error: any) {
          return next(new ErrorHandler(error.message, 400));
        }
      } else {
        // Nếu người dùng đã đăng nhập
        userId = req.user?._id;
        if (!userId) {
          return next(new ErrorHandler("Vui lòng đăng nhập", 400));
        }
      }

      // Kiểm tra các trường bắt buộc cho mentor
      if (!bio || !specialization || !experience) {
        return next(new ErrorHandler("Vui lòng điền đầy đủ thông tin mentor", 400));
      }

      // Kiểm tra xem đã đăng ký làm mentor chưa
      const existingMentor = await MentorModel.findOne({ user: userId });
      if (existingMentor) {
        return next(new ErrorHandler("Bạn đã đăng ký làm mentor trước đó", 400));
      }

      // Tạo mentor mới
      const mentor = await MentorModel.create({
        user: userId,
        bio,
        specialization,
        experience,
        achievements,
        applicationStatus: "pending",
        applicationDate: new Date()
      });

      // Tạo thông báo cho admin
      await NotificationModel.create({
        title: "Đăng ký làm mentor mới",
        message: `Người dùng mới đăng ký làm mentor. Vui lòng xem xét.`,
        status: "unread"
      });

      // Nếu là người dùng mới, trả về token
      if (isNewUser) {
        const user = await userModel.findById(userId);
        if (user) {
          sendToken(user, 201, res);
        } else {
          res.status(201).json({
            success: true,
            message: "Đăng ký thành công, vui lòng đăng nhập",
            mentor
          });
        }
      } else {
        res.status(201).json({
          success: true,
          mentor
        });
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Tạo activation token
interface IActivationToken {
  token: string;
  activationCode: string;
}

export const createActivationToken = (user: any): IActivationToken => {
  const activationCode = Math.floor(1000 + Math.random() * 9000).toString();

  const token = jwt.sign(
    {
      user,
      activationCode,
    },
    process.env.ACTIVATION_SECRET as string,
    {
      expiresIn: "5m",
    }
  );

  return { token, activationCode };
};

// Lấy thông tin mentor
export const getMentorInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return next(new ErrorHandler("Vui lòng đăng nhập", 400));
      }

      const mentor = await MentorModel.findOne({ user: userId }).populate("courses");
      if (!mentor) {
        return next(new ErrorHandler("Không tìm thấy thông tin mentor", 404));
      }

      res.status(200).json({
        success: true,
        mentor
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Admin phê duyệt hoặc từ chối mentor
export const updateMentorStatus = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { mentorId, status } = req.body;
      
      if (!["pending", "approved", "rejected"].includes(status)) {
        return next(new ErrorHandler("Trạng thái không hợp lệ", 400));
      }

      const mentor = await MentorModel.findById(mentorId);
      if (!mentor) {
        return next(new ErrorHandler("Không tìm thấy mentor", 404));
      }

      mentor.applicationStatus = status;
      
      // Nếu phê duyệt, cập nhật role user thành mentor
      if (status === "approved") {
        mentor.approved = true;
        
        const user = await userModel.findById(mentor.user);
        if (user) {
          user.role = "mentor";
          await user.save();
          
          // Clear redis cache
          await redis.del(user._id);
        }

        // Gửi email thông báo cho người dùng
        const userData = await userModel.findById(mentor.user);
        if (userData) {
          await sendMail({
            email: userData.email,
            subject: "Chúc mừng! Bạn đã trở thành mentor",
            template: "mentor-approved.ejs",
            data: {
              user: {
                name: userData.name
              }
            }
          });
        }
      }

      await mentor.save();

      res.status(200).json({
        success: true,
        mentor
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Lấy tất cả mentor cho admin
export const getAllMentors = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mentors = await MentorModel.find()
        .populate("user", "name email avatar")
        .populate("courses");

      res.status(200).json({
        success: true,
        mentors
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Lấy danh sách đăng ký mentor đang chờ xử lý
export const getPendingMentors = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pendingMentors = await MentorModel.find({ applicationStatus: "pending" })
        .populate("user", "name email avatar");

      res.status(200).json({
        success: true,
        pendingMentors
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Đánh giá mentor
interface IMentorReviewRequest {
  mentorId: string;
  rating: number;
  comment: string;
}

export const reviewMentor = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { mentorId, rating, comment } = req.body as IMentorReviewRequest;
      const userId = req.user?._id;

      if (!userId) {
        return next(new ErrorHandler("Vui lòng đăng nhập", 400));
      }

      // Kiểm tra xem mentor có tồn tại không
      const mentor = await MentorModel.findById(mentorId);
      if (!mentor) {
        return next(new ErrorHandler("Không tìm thấy mentor", 404));
      }

      // Tạo đánh giá mới
      const review = {
        user: userId,
        rating,
        comment,
        createdAt: new Date()
      };

      // Thêm đánh giá vào mentor
      mentor.reviews.push(review as any);
      
      // Tính lại điểm trung bình
      let totalRating = 0;
      mentor.reviews.forEach((rev: any) => {
        totalRating += rev.rating;
      });
      
      mentor.averageRating = totalRating / mentor.reviews.length;
      
      await mentor.save();

      res.status(201).json({
        success: true,
        message: "Đánh giá mentor thành công"
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Lấy danh sách khóa học của mentor
export const getMentorCourses = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return next(new ErrorHandler("Vui lòng đăng nhập", 400));
      }

      // Tìm mentor ID từ user ID
      const mentor = await MentorModel.findOne({ user: userId });
      if (!mentor) {
        return next(new ErrorHandler("Không tìm thấy thông tin mentor", 404));
      }

      // Lấy danh sách khóa học của mentor
      const courses = await CourseModel.find({ mentor: mentor._id });

      res.status(200).json({
        success: true,
        courses
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Lấy chi tiết mentor theo ID
export const getMentorById = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      const mentor = await MentorModel.findById(id)
        .populate("user", "name email avatar")
        .populate("courses");
        
      if (!mentor) {
        return next(new ErrorHandler("Không tìm thấy mentor", 404));
      }

      res.status(200).json({
        success: true,
        mentor
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);