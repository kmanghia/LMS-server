import express from "express";
import { isAutheticated } from "../middleware/auth";
import { 
  createCourseGroupChat,
  createOrGetPrivateChat,
  getChatById, 
  getUserChats,
  uploadAttachments
} from "../controllers/chat.controller";
import { upload } from "../utils/multer";

const chatRouter = express.Router();


chatRouter.post("/chat/private", isAutheticated, createOrGetPrivateChat);


chatRouter.get("/chat/all", isAutheticated, getUserChats);

chatRouter.get("/chat/:id", isAutheticated, getChatById);


chatRouter.post("/chat/course", isAutheticated, createCourseGroupChat);

// Add attachment upload route
chatRouter.post("/chat/upload-attachments", isAutheticated, upload.array('files', 5) as any, uploadAttachments);


export default chatRouter; 