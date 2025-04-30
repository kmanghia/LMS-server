import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import { IOrder } from "../models/order.Model";
import userModel from "../models/user.model";
import CourseModel, { ICourse } from "../models/course.model";
import path from "path";
import ejs from "ejs";
import {
  sendMail
} from "../utils/sendMail";
import NotificationModel from "../models/notification.Model";
import { getAllOrdersService, newOrder } from "../services/order.service";
import { redis } from "../utils/redis";
import { emitNotification } from "../socketServer";
import { createCourseGroupChat } from "./chat.controller";
import MentorModel from "../models/mentor.model";
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Add user to course chat function
const addUserToCourseChat = async (courseId: string, userId: string) => {
  try {
    // Tạo request và response objects giả để gọi controller function
    const mockRequest = {
      body: { courseId, userId }
    } as Request;
    
    const mockResponse = {
      status: function(code: number) {
        return {
          json: function(data: any) {
            console.log(`User ${userId} added to course chat for course ${courseId}`);
            return data;
          }
        };
      }
    } as Response;
    
    const mockNext = ((error: any) => {
      if (error) {
        console.error("Error adding user to course chat:", error);
      }
    }) as NextFunction;
    
    // Gọi trực tiếp controller function
    await createCourseGroupChat(mockRequest, mockResponse, mockNext);
  } catch (error) {
    console.error("Error adding user to course chat:", error);
    // Non-blocking error - don't throw, just log
  }
};

// create order
export const createOrder = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId, payment_info } = req.body as IOrder;

      if (payment_info) {
        if ("id" in payment_info) {
          const paymentIntentId = payment_info.id;
          const paymentIntent = await stripe.paymentIntents.retrieve(
            paymentIntentId
          );

          if (paymentIntent.status !== "succeeded") {
            return next(new ErrorHandler("Thanh toán không được ủy quyền!", 400));
          }
        }
      }

      const user = await userModel.findById(req.user?._id);

      const courseExistInUser = user?.courses.some(
        (course: any) => course._id.toString() === courseId
      );

      if (courseExistInUser) {
        return next(
          new ErrorHandler("Bạn đã mua khóa học này", 400)
        );
      }

      const course: ICourse | null = await CourseModel.findById(courseId);

      if (!course) {
        return next(new ErrorHandler("Không tìm thấy khóa học", 404));
      }

      const data: any = {
        courseId: course._id,
        userId: user?._id,
        payment_info,
      };

      const mailData = {
        order: {
          _id: course._id.toString().slice(0, 6),
          name: course.name,
          price: course.price,
          date: new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        },
      };

      const html = await ejs.renderFile(
        path.join(__dirname, "../mails/order-confirmation.ejs"),
        { order: mailData }
      );

      try {
        if (user) {
          await sendMail({
            email: user.email,
            subject: "Xác nhận đơn hàng",
            template: "order-confirmation.ejs",
            data: mailData,
          });
        }
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
      }

      user?.courses.push(course?._id);

      await redis.set(req.user?._id, JSON.stringify(user));

      await user?.save();

      const notification = await NotificationModel.create({
        userId: user?._id,
        title: "Đơn hàng mới",
        message: `Bạn đã mua khóa học "${course?.name}" thành công`,
        recipientRole: "user",
        type: "purchase",
        courseId: course?._id.toString(),
        link: `/courses/${course?._id}`
      });
      emitNotification(notification);

      // Thông báo cho mentor về đơn hàng mới
      const courseOwner = await MentorModel.findById(course?.mentor);
      if (courseOwner) {
        const mentorNotification = await NotificationModel.create({
          userId: courseOwner.user.toString(),
          title: "Có học viên mới",
          message: `Học viên ${user?.name} đã mua khóa học "${course?.name}"`,
          recipientRole: "mentor",
          type: "purchase",
          courseId: course?._id.toString(),
          link: `/mentor/courses/${course?._id}`
        });
        emitNotification(mentorNotification);
      }

      course.purchased = course.purchased + 1;

      await course.save();

      // Add user to course chat
      if (user?._id && course?._id) {
        await addUserToCourseChat(course._id.toString(), user._id.toString());
      }

      newOrder(data, res, next);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// create order for mobile
export const createMobileOrder = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId, payment_info } = req.body as IOrder;
      const user = await userModel.findById(req.user?._id);

      const courseExistInUser = user?.courses.some(
        (course: any) => course._id.toString() === courseId
      );

      if (courseExistInUser) {
        return next(
          new ErrorHandler("Bạn đã mua khóa học này", 400)
        );
      }

      const course: ICourse | null = await CourseModel.findById(courseId);

      if (!course) {
        return next(new ErrorHandler("Không tìm thấy khóa học", 404));
      }

      const data: any = {
        courseId: course._id,
        userId: user?._id,
        payment_info,
      };

      const mailData = {
        order: {
          _id: course._id.toString().slice(0, 6),
          name: course.name,
          price: course.price,
          date: new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        },
      };

      const html = await ejs.renderFile(
        path.join(__dirname, "../mails/order-confirmation.ejs"),
        { order: mailData }
      );

      try {
        if (user) {
          await sendMail({
            email: user.email,
            subject: "Order Confirmation",
            template: "order-confirmation.ejs",
            data: mailData,
          });
        }
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
      }

      user?.courses.push(course?._id);
      const courses = await CourseModel.find().select(
        "-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links"
      );
      const cloneCourse = courses.filter(item => item._id.toString() === courseId)[0];

      let _coursePush = {
        courseId: cloneCourse._id as string,
        chapters: cloneCourse.courseData.map((data) => ({
          chapterId: data._id as string,
          isCompleted: false
        }))
      }
      console.log(_coursePush);
      user?.progress?.push(_coursePush as any);

      await redis.set(req.user?._id, JSON.stringify(user));

      await user?.save();

      const notification = await NotificationModel.create({
        userId: user?._id,
        title: "Đơn hàng mới",
        message: `Bạn đã mua khóa học "${course?.name}" thành công`,
        recipientRole: "user",
        type: "purchase",
        courseId: course?._id.toString(),
        link: `/courses/${course?._id}`
      });
      emitNotification(notification);

      // Thông báo cho mentor về đơn hàng mới
      const courseOwner = await MentorModel.findById(course?.mentor);
      if (courseOwner) {
        const mentorNotification = await NotificationModel.create({
          userId: courseOwner.user.toString(),
          title: "Có học viên mới",
          message: `Học viên ${user?.name} đã mua khóa học "${course?.name}"`,
          recipientRole: "mentor",
          type: "purchase",
          courseId: course?._id.toString(),
          link: `/mentor/courses/${course?._id}`
        });
        emitNotification(mentorNotification);
      }

      course.purchased = course.purchased + 1;

      await course.save();

      // Add user to course chat
      if (user?._id && course?._id) {
        await addUserToCourseChat(course._id.toString(), user._id.toString());
      }

      newOrder(data, res, next);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// get All orders --- only for admin
export const getAllOrders = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      getAllOrdersService(res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

//  send stripe publishble key
export const sendStripePublishableKey = CatchAsyncError(
  async (req: Request, res: Response) => {
    res.status(200).json({
      publishablekey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  }
);

// new payment
export const newPayment = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const myPayment = await stripe.paymentIntents.create({
        amount: req.body.amount,
        currency: "vnd",
        metadata: {
          company: "E-Learning",
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });
      res.status(201).json({
        success: true,
        client_secret: myPayment.client_secret,
      });
    } catch (error: any) {
      console.log(error);
      return next(new ErrorHandler(error.message, 500));
    }
  }
);


