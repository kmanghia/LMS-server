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
import NotificationModel from "../models/notification.Model";
import axios from "axios";
import { uploadBase64ToS3, deleteFile } from '../utils/s3'
import jwt from 'jsonwebtoken'
import quizzModel from "../models/quizz.model";

export const saveResultQuizzOfUser = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { userId, courseId, lessonId, scored, selected_options } = req.body;

            // Đổi tên selected_questions thành selected_options nếu cần
            const quizzData = {
                userId,
                courseId,
                lessonId,
                scored,
                selected_options: selected_options  // Đảm bảo tên trường trùng khớp
            };

            // Tạo mới một quizz
            const quizz = await quizzModel.create(quizzData);

            res.status(201).json({
                success: true,
                quizz
            });

        } catch (error: any) {
            return next(new ErrorHandler(error.message, 500));
        }
    }
);

export const fetchAllQuizzOfUser = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const id = req.user?._id;
            const { lessonId } = req.query;
            const response = await quizzModel.find({
                lessonId: lessonId
            });

            res.status(200).json({
                success: true,
                response,
                userId: id,

            });

        } catch (error: any) {
            return next(new ErrorHandler(error.message, 500));
        }
    }
);


