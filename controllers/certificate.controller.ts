import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import CertificateModel from "../models/certificate.model";
import CourseModel from "../models/course.model";
import userModel from "../models/user.model";
import mongoose from "mongoose";

// Get all certificates for a user
export const getUserCertificates = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      
      const certificates = await CertificateModel.find({ userId })
        .populate({
          path: "courseId",
          select: "name thumbnail",
        });
      
      res.status(200).json({
        success: true,
        certificates,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Get single certificate by id
export const getCertificateById = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { certificateId } = req.params;
      
      const certificate = await CertificateModel.findById(certificateId)
        .populate({
          path: "courseId",
          select: "name thumbnail level categories mentor",
          populate: {
            path: "mentor",
            select: "name"
          }
        })
        .populate({
          path: "userId",
          select: "name email"
        });
      
      if (!certificate) {
        return next(new ErrorHandler("Certificate not found", 404));
      }
      
      res.status(200).json({
        success: true,
        certificate,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Manually create certificate for a user (admin only)
export const createCertificate = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, courseId } = req.body;
      
      // Check if user and course exist
      const user = await userModel.findById(userId);
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }
      
      const course = await CourseModel.findById(courseId).populate("mentor", "name");
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }
      
      // Check if certificate already exists
      const existingCertificate = await CertificateModel.findOne({
        userId,
        courseId
      });
      
      if (existingCertificate) {
        return next(new ErrorHandler("Certificate already exists for this user and course", 400));
      }
      
      // Create certificate
      const certificate = await CertificateModel.create({
        userId,
        courseId,
        userNameAtIssue: user.name,
        courseNameAtIssue: course.name,
        mentorNameAtIssue: course.mentor ? (course.mentor as any).name : "Unknown Instructor",
        issueDate: new Date()
      });
      
      res.status(201).json({
        success: true,
        certificate,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// Verify a certificate by id (public route)
export const verifyCertificate = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { certificateId } = req.params;
      
      if (!mongoose.Types.ObjectId.isValid(certificateId)) {
        return next(new ErrorHandler("Invalid certificate ID", 400));
      }
      
      const certificate = await CertificateModel.findById(certificateId)
        .populate({
          path: "userId",
          select: "name email"
        })
        .populate({
          path: "courseId",
          select: "name"
        });
      
      if (!certificate) {
        return next(new ErrorHandler("Certificate not found or invalid", 404));
      }
      
      res.status(200).json({
        success: true,
        isValid: true,
        certificate: {
          id: certificate._id,
          userName: certificate.userNameAtIssue,
          courseName: certificate.courseNameAtIssue,
          mentorName: certificate.mentorNameAtIssue,
          issueDate: certificate.issueDate,
        }
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
); 