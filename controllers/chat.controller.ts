import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import ChatModel from "../models/chat.model";
import userModel from "../models/user.model";
import mongoose from "mongoose";
import CourseModel from "../models/course.model";
import MentorModel from "../models/mentor.model";
import { sendDirectMessage, getChatParticipants } from "../socketServer";

// Create or get a private chat between a user and a mentor
export const createOrGetPrivateChat = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { mentorId } = req.body;
      const userId = req.user?._id;

      if (!mentorId) {
        return next(new ErrorHandler("Mentor ID is required", 400));
      }

      // Validate mentor exists
      const mentor = await MentorModel.findById(mentorId);
      if (!mentor) {
        return next(new ErrorHandler("Mentor not found", 404));
      }

      // Check if chat already exists
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

      // Create new private chat
      const newChat = await ChatModel.create({
        chatType: "private",
        participants: [userId, mentor.user],
        mentorId: mentorId,
        messages: []
      });

      // Populate participant details
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

// Get all user chats (both private and course)
export const getUserChats = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      
      console.log("Getting chats for user:", userId);
      
      if (!userId) {
        console.log("No user ID found in request");
        return next(new ErrorHandler("User not authenticated", 401));
      }

      // Get all chats where user is a participant
      console.log("Finding chats for user:", userId);
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

      console.log("Found chats:", chats.length);

      // Group chats by type
      const privateChats = chats.filter(chat => chat.chatType === "private");
      const courseChats = chats.filter(chat => chat.chatType === "course");

      console.log("Private chats:", privateChats.length);
      console.log("Course chats:", courseChats.length);

      res.status(200).json({
        success: true,
        privateChats,
        courseChats
      });

    } catch (error: any) {
      console.error("Error in getUserChats:", error);
      console.error("Error stack:", error.stack);
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Get chat by ID with messages
export const getChatById = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const chatId = req.params.id;
      const userId = req.user?._id;

      console.log(`Getting chat with ID: ${chatId} for user: ${userId}`);

      const chat = await ChatModel.findById(chatId)
        .populate({
          path: "participants",
          select: "name avatar"
        })
        .populate({
          path: "courseId",
          select: "name thumbnail"
        });

      console.log("Found chat:", chat ? "yes" : "no");

      if (!chat) {
        console.log("Chat not found");
        return next(new ErrorHandler("Chat not found", 404));
      }

      // Verify user is a participant - handle both object and string IDs
      let isParticipant = false;
      
      if (chat.participants && chat.participants.length > 0) {
        // Check if participants array contains objects or just IDs
        const firstParticipant = chat.participants[0];
        
        console.log("First participant type:", typeof firstParticipant);
        console.log("User ID for comparison:", userId);
        
        if (typeof firstParticipant === 'object' && firstParticipant !== null) {
          // Participants have been populated with user objects
          isParticipant = chat.participants.some(p => {
            // Sử dụng type assertion để TypeScript hiểu p có thể là object
            const pObject = p as any;
            const participantId = pObject._id ? pObject._id.toString() : p.toString();
            return participantId === userId.toString();
          });
        } else {
          // Participants are still ObjectIDs
          isParticipant = chat.participants.some(p => p.toString() === userId.toString());
        }
      }

      console.log("Is user a participant:", isParticipant);

      if (!isParticipant) {
        console.log("User not authorized to view chat");
        return next(new ErrorHandler("You are not authorized to view this chat", 403));
      }

      // Mark all unread messages as read
      const unreadMessages = chat.messages.filter(
        message => 
          message.sender.toString() !== userId.toString() && 
          !message.readBy.includes(userId)
      );

      console.log("Number of unread messages:", unreadMessages.length);

      if (unreadMessages.length > 0) {
        const unreadMessageIds = unreadMessages.map(msg => msg._id);
        console.log("Unread message IDs:", unreadMessageIds);
        
        // Update read status
        console.log("Updating read status for messages");
        await ChatModel.updateMany(
          { _id: chatId, "messages._id": { $in: unreadMessageIds } },
          { $addToSet: { "messages.$[elem].readBy": userId } },
          { arrayFilters: [{ "elem._id": { $in: unreadMessageIds } }] }
        );
        
        // Notify other participants
        console.log("Getting chat participants");
        const chatParticipants = await getChatParticipants(chatId);
        console.log("Chat participants:", chatParticipants);

        chatParticipants.forEach(participantId => {
          if (participantId !== userId.toString()) {
            console.log(`Notifying participant ${participantId} about read messages`);
            sendDirectMessage(participantId, "messagesRead", { 
              chatId, 
              messageIds: unreadMessageIds, 
              userId 
            });
          }
        });
      }

      console.log("Sending chat data in response");
      res.status(200).json({
        success: true,
        chat
      });

    } catch (error: any) {
      console.error("Error in getChatById:", error);
      console.error("Error stack:", error.stack);
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Create a course group chat when user purchases a course
export const createCourseGroupChat = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { courseId, userId } = req.body;
      
      if (!courseId || !userId) {
        return next(new ErrorHandler("Course ID and User ID are required", 400));
      }

      // Validate course exists
      const course = await CourseModel.findById(courseId);
      if (!course) {
        return next(new ErrorHandler("Course not found", 404));
      }

      // Get the mentor
      const mentor = await MentorModel.findById(course.mentor);
      if (!mentor) {
        return next(new ErrorHandler("Mentor not found", 404));
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
          name: course.name + " Discussion Group",
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
        message: "User added to course chat successfully",
        chatId: courseChat._id
      });

    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
); 