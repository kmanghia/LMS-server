import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import ChatModel from "../models/chat.model";
import userModel from "../models/user.model";
import mongoose from "mongoose";
import CourseModel from "../models/course.model";
import MentorModel from "../models/mentor.model";
import { sendDirectMessage, getChatParticipants } from "../socketServer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";


export const createOrGetPrivateChat = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { mentorId } = req.body;
      const userId = req.user?._id;

      if (!mentorId) {
        return next(new ErrorHandler("Mentor ID is required", 400));
      }

      
      const mentor = await MentorModel.findById(mentorId);
      if (!mentor) {
        return next(new ErrorHandler("Mentor not found", 404));
      }


      const existingChat = await ChatModel.findOne({
        chatType: "private",
        participants: { $all: [userId, mentor.user] },
        mentorId: mentorId
      }).populate({
        path: "participants",
        select: "name avatar"
      });

      if (existingChat) {
        return res.status(200).json({
          success: true,
          chat: existingChat
        });
      }

      
      const newChat = await ChatModel.create({
        chatType: "private",
        participants: [userId, mentor.user],
        mentorId: mentorId,
        messages: []
      });

    
      const populatedChat = await ChatModel.findById(newChat._id).populate({
        path: "participants",
        select: "name avatar"
      });

      res.status(201).json({
        success: true,
        chat: populatedChat
      });

    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);


export const getUserChats = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      
      
      
      if (!userId) {
        
        return next(new ErrorHandler("User not authenticated", 401));
      }

    
      const chats = await ChatModel.find({
        participants: userId
      })
      .populate({
        path: "participants", 
        select: "name avatar"
      })
      .populate({
        path: "courseId",
        select: "name thumbnail"
      })
      .populate({
        path: "mentorId",
        select: "user"
      })
      .sort({ updatedAt: -1 });

   

      const privateChats = chats.filter(chat => chat.chatType === "private");
      const courseChats = chats.filter(chat => chat.chatType === "course");

    

      res.status(200).json({
        success: true,
        privateChats,
        courseChats
      });

    } catch (error: any) {
      
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

export const getChatById = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const chatId = req.params.id;
      const userId = req.user?._id;

  

      const chat = await ChatModel.findById(chatId)
        .populate({
          path: "participants",
          select: "name avatar"
        })
        .populate({
          path: "courseId",
          select: "name thumbnail"
        });

      

      if (!chat) {
    
        return next(new ErrorHandler("Chat không tìm thấy", 404));
      }

    
      let isParticipant = false;
      
      if (chat.participants && chat.participants.length > 0) {
        const firstParticipant = chat.participants[0];
        
       
        
        if (typeof firstParticipant === 'object' && firstParticipant !== null) {
  
          isParticipant = chat.participants.some(p => {
            
            const pObject = p as any;
            const participantId = pObject._id ? pObject._id.toString() : p.toString();
            return participantId === userId.toString();
          });
        } else {
          
          isParticipant = chat.participants.some(p => p.toString() === userId.toString());
        }
      }

  

      if (!isParticipant) {
        
        return next(new ErrorHandler("You are not authorized to view this chat", 403));
      }

      // Mark all unread messages as read
      const unreadMessages = chat.messages.filter(
        message => 
          message.sender.toString() !== userId.toString() && 
          !message.readBy.includes(userId)
      );



      if (unreadMessages.length > 0) {
        const unreadMessageIds = unreadMessages.map(msg => msg._id);
    
        await ChatModel.updateMany(
          { _id: chatId, "messages._id": { $in: unreadMessageIds } },
          { $addToSet: { "messages.$[elem].readBy": userId } },
          { arrayFilters: [{ "elem._id": { $in: unreadMessageIds } }] }
        );
        

        const chatParticipants = await getChatParticipants(chatId);
        

        chatParticipants.forEach(participantId => {
          if (participantId !== userId.toString()) {
            
            sendDirectMessage(participantId, "messagesRead", { 
              chatId, 
              messageIds: unreadMessageIds, 
              userId 
            });
          }
        });
      }

      console.log("Gửi dữ liệu chat về trong phản hồi");
      res.status(200).json({
        success: true,
        chat
      });

    } catch (error: any) {
      console.error("Lỗi khi getChatById:", error);
      console.error("Lỗi Stack:", error.stack);
      return next(new ErrorHandler(error.message, 500));
    }
  }
);


export const createCourseGroupChat = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId, userId } = req.body;
      
      if (!courseId || !userId) {
        return next(new ErrorHandler("ID khóa học và ID người dùng bắt buộc", 400));
      }

      // Validate course exists
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Khóa học không tìm thấy", 404));
      }

      // Get the mentor
      const mentor = await MentorModel.findById(course.mentor);
      if (!mentor) {
        return next(new ErrorHandler("Không tìm thấy giảng viên", 404));
      }

      // Check if a group chat already exists for this course
      let courseChat = await ChatModel.findOne({
        chatType: "course",
        courseId: courseId
      });

      if (courseChat) {
        // Add user to chat if not already a participant
        if (!courseChat.participants.includes(userId)) {
          courseChat.participants.push(userId);
          await courseChat.save();
        }
      } else {
        // Create new course group chat
        courseChat = await ChatModel.create({
          name: course.name + " Nhóm thảo luận",
          chatType: "course",
          participants: [mentor.user, userId],
          courseId: courseId,
          mentorId: course.mentor,
          messages: []
        });

        // Add welcome message
        courseChat.messages.push({
          sender: mentor.user,
          content: `Chào mừng bạn đến với nhóm thảo luận ${course.name}! Hãy thoải mái đặt câu hỏi và chia sẻ những hiểu biết của bạn với các bạn cùng lớp.`,
          readBy: [mentor.user],
          createdAt: new Date()
        } as any);
        
        await courseChat.save();
      }

      res.status(201).json({
        success: true,
        message: "Thêm người dùng vào khóa học thành công",
        chatId: courseChat._id
      });

    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Add upload attachments controller
export const uploadAttachments = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.files || req.files.length === 0) {
        return next(new ErrorHandler("No files uploaded", 400));
      }

      const uploadedFiles = Array.isArray(req.files) ? req.files : [req.files];
      const attachments = uploadedFiles.map(file => {
        // Determine file type
        let type = 'document';
        const mimeType = file.mimetype as string;

        if (mimeType.startsWith('image/')) {
          type = 'image';
        } else if (mimeType.startsWith('video/')) {
          type = 'video';
        } else if (mimeType.startsWith('audio/')) {
          type = 'audio';
        }

        // Extract only the filename from the path
        const filePath = file.path as string;
        // Handle both Windows and Unix-style paths
        const filename = filePath.split(/[\/\\]/).pop() || '';
        
        // Generate thumbnail for certain file types
        let thumbnailUrl = undefined;
        if (type === 'image') {
          // For images, use only the filename for thumbnail too
          thumbnailUrl = `thumbnail_${filename}`;
        }

        return {
          type,
          url: filename, // Store only the filename
          filename: file.originalname as string,
          mimeType: mimeType,
          size: file.size as number,
          thumbnailUrl
        };
      });

      res.status(200).json({
        success: true,
        attachments
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);


     
  
  
      
    


  
   
    

   
   

     
    
 
 

 
   
  
