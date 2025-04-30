import NotificationModel from "../models/notification.Model";
import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import cron from "node-cron";
import { redis } from "../utils/redis";
import MentorModel from "../models/mentor.model";
import { emitNotification, sendDirectMessage } from "../socketServer";


// Lấy tất cả thông báo (dành cho admin)
export const getNotifications = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notifications = await NotificationModel.find().sort({
        createdAt: -1,
      });

      res.status(201).json({
        success: true,
        notifications,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Lấy thông báo dành cho user
export const getUserNotifications = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return next(new ErrorHandler("Vui lòng đăng nhập", 401));
      }

      // Lấy thông báo cho user cụ thể hoặc cho tất cả user
      const notifications = await NotificationModel.find({
        $or: [
          { userId: userId, recipientRole: "user" },
          { recipientRole: "user", userId: { $exists: false } },
          { recipientRole: "all" }
        ]
      }).sort({ createdAt: -1 });

      console.log("NOtifications:"+notifications)
      res.status(200).json({
        success: true,
        notifications,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Lấy thông báo dành cho mentor
export const getMentorNotifications = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return next(new ErrorHandler("Vui lòng đăng nhập", 401));
      }

      // Tìm mentorId tương ứng với userId này
      const mentor = await MentorModel.findOne({ user: userId });
      const mentorId = mentor?._id;

      // Lấy thông báo cho mentor cụ thể hoặc cho tất cả mentor
      const notifications = await NotificationModel.find({
        $or: [
          { userId: userId, recipientRole: "mentor" }, // Tìm theo userId
          { userId: mentorId, recipientRole: "mentor" }, // Tìm theo mentorId
          { recipientRole: "mentor", userId: { $exists: false } }, // Thông báo cho tất cả mentor
          { recipientRole: "all" } // Thông báo cho tất cả
        ]
      }).sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        notifications,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Cập nhật trạng thái thông báo
export const updateNotification = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notification = await NotificationModel.findById(req.params.id);
      if (!notification) {
        return next(new ErrorHandler("Không tìm thấy thông báo", 404));
      } else {
        notification.status = "read";
      }

      await notification.save();

      // Trả về thông báo phù hợp với vai trò của người dùng
      const userId = req.user?._id;
      const role = req.user?.role;
      
      let notifications;
      
      if (role === "admin") {
        notifications = await NotificationModel.find().sort({
          createdAt: -1,
        });
      } else if (role === "mentor") {
        notifications = await NotificationModel.find({
          $or: [
            { userId: userId, recipientRole: "mentor" },
            { recipientRole: "mentor", userId: { $exists: false } },
            { recipientRole: "all" }
          ]
        }).sort({ createdAt: -1 });
      } else {
        notifications = await NotificationModel.find({
          $or: [
            { userId: userId, recipientRole: "user" },
            { recipientRole: "user", userId: { $exists: false } },
            { recipientRole: "all" }
          ]
        }).sort({ createdAt: -1 });
      }

      res.status(200).json({
        success: true,
        notifications,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Tạo thông báo mới (hàm tiện ích để sử dụng trong các controller khác)
export const createNotification = async (data: {
  title: string;
  message: string;
  userId?: string;
  recipientRole: string;
  sender?: string;
  courseId?: string;
  type: string;
  link?: string;
}) => {
  try {
    const notification = await NotificationModel.create(data);
    
    // Gửi thông báo realtime qua socket
    console.log(`Emitting notification for role: ${data.recipientRole}, userId: ${data.userId || 'all'}`);
    
    // Nếu có userId cụ thể, gửi thông báo trực tiếp cho user đó
    if (data.userId) {
      sendDirectMessage(data.userId, "new_notification", notification);
    } 
    // Nếu là thông báo cho tất cả người dùng thuộc role
    else {
      emitNotification({
        ...notification.toObject(),
        recipientRole: data.recipientRole
      });
    }
    
    // Clear cache nếu cần thiết
    if (data.userId) {
      await redis.del(`notifications-${data.userId}`);
    }
    
    return notification;
  } catch (error: any) {
    console.log("Lỗi khi tạo thông báo:", error.message);
  }
};

// Lên lịch xóa thông báo đã đọc sau 30 ngày
cron.schedule("0 0 0 * * *", async() => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await NotificationModel.deleteMany({status:"read",createdAt: {$lt: thirtyDaysAgo}});
  console.log('Đã xóa thông báo đã đọc');
});