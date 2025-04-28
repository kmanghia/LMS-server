import express from "express";
import {
  createOrGetPrivateChat,
  getUserChats,
  getChatById,
  createCourseGroupChat
} from "../controllers/chat.controller";
import { isAutheticated } from "../middleware/auth";

const chatRouter = express.Router();

// Create or get private chat with mentor
chatRouter.post("/chat/private", isAutheticated, createOrGetPrivateChat);

// Get all user chats
chatRouter.get("/chat/all", isAutheticated, getUserChats);

// Get chat by ID
chatRouter.get("/chat/:id", isAutheticated, getChatById);

// Create course group chat (internal API, typically called from order creation)
chatRouter.post("/chat/course", isAutheticated, createCourseGroupChat);

export default chatRouter; 