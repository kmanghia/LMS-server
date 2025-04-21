import { Server as SocketIOServer } from "socket.io";
import http from "http";
import ChatModel from "./models/chat.model";
import mongoose from "mongoose";

let io: SocketIOServer;
const connectedUsers = new Map(); // Map to track user connections by userId

export const initSocketServer = (server: http.Server) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: "*", // In production, specify trusted origins
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Authenticate user and track their socket
    socket.on("authenticate", (userId: string) => {
      if (userId) {
        console.log(`User ${userId} authenticated with socket ${socket.id}`);
        // Add user to connected users map
        socket.join(`user:${userId}`);
        connectedUsers.set(userId, socket.id);
        
        // Emit online status to interested parties
        io.emit("userStatusChanged", { userId, status: "online" });
      }
    });

    // Join a specific chat room
    socket.on("joinChat", (chatId: string) => {
      if (chatId) {
        socket.join(`chat:${chatId}`);
        console.log(`Socket ${socket.id} joined chat:${chatId}`);
      }
    });

    // Leave a chat room
    socket.on("leaveChat", (chatId: string) => {
      if (chatId) {
        socket.leave(`chat:${chatId}`);
        console.log(`Socket ${socket.id} left chat:${chatId}`);
      }
    });

    // Handle new message
    socket.on("sendMessage", async (data) => {
      try {
        const { chatId, message, senderId } = data;
        
        if (!chatId || !message || !senderId) {
          return;
        }

        // Add message to database
        const chat = await ChatModel.findById(chatId);
        if (!chat) return;

        // Create message object without typecasting to IMessage
        chat.messages.push({
          sender: new mongoose.Types.ObjectId(senderId),
          content: message,
          readBy: [new mongoose.Types.ObjectId(senderId)],
          createdAt: new Date()
        } as any); // Use 'as any' to bypass type check
        
        await chat.save();

        // Get the newly added message with its generated _id
        const savedMessage = chat.messages[chat.messages.length - 1];

        // Broadcast to all users in the chat room
        io.to(`chat:${chatId}`).emit("newMessage", {
          chatId,
          message: savedMessage
        });

        // Send push notifications to offline users
        chat.participants.forEach(participantId => {
          const participantIdStr = participantId.toString();
          if (participantIdStr !== senderId && !connectedUsers.has(participantIdStr)) {
            // User is offline - would send push notification in a real implementation
            console.log(`User ${participantIdStr} is offline. Send push notification.`);
          }
        });
      } catch (error) {
        console.error("Error processing message:", error);
      }
    });

    // Handle typing indicators
    socket.on("typing", (data) => {
      const { chatId, userId, isTyping } = data;
      // Broadcast typing status to all users in this chat except sender
      socket.to(`chat:${chatId}`).emit("userTyping", { chatId, userId, isTyping });
    });

    // Handle read receipts
    socket.on("markAsRead", async (data) => {
      try {
        const { chatId, messageIds, userId } = data;
        
        if (!chatId || !userId) return;
        
        // Update read status in database
        await ChatModel.updateMany(
          { _id: chatId, "messages._id": { $in: messageIds } },
          { $addToSet: { "messages.$[elem].readBy": new mongoose.Types.ObjectId(userId) } },
          { arrayFilters: [{ "elem._id": { $in: messageIds } }] }
        );
        
        // Notify other users about read status
        socket.to(`chat:${chatId}`).emit("messagesRead", { chatId, messageIds, userId });
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    });

    // Listen for 'notification' event from the frontend
    socket.on("notification", (data) => {
      // Broadcast the notification data to all connected clients (admin dashboard)
      io.emit("newNotification", data);
    });

    socket.on("disconnect", () => {
      console.log(`Socket ${socket.id} disconnected`);
      
      // Find and remove user from connected users
      for (const [userId, socketId] of connectedUsers.entries()) {
        if (socketId === socket.id) {
          connectedUsers.delete(userId);
          io.emit("userStatusChanged", { userId, status: "offline" });
          console.log(`User ${userId} is now offline`);
          break;
        }
      }
    });
  });
};

// Helper function to emit notifications
export const emitNotification = (notification: any) => {
  if (io) {
    // Emit notification data
    io.emit("newNotification", notification);
    // Emit audio event separately
    io.emit("playNotificationSound");
    console.log("Notification and sound emitted");
  } else {
    console.error("Socket.IO server not initialized");
  }
};

// Helper to send a direct message to a specific user
export const sendDirectMessage = (userId: string, eventName: string, data: any) => {
  if (io) {
    io.to(`user:${userId}`).emit(eventName, data);
    return true;
  }
  return false;
};

// Helper to check if a user is online
export const isUserOnline = (userId: string): boolean => {
  return connectedUsers.has(userId);
};

// Helper to get all participants of a chat
export const getChatParticipants = async (chatId: string): Promise<string[]> => {
  try {
    const chat = await ChatModel.findById(chatId);
    if (!chat) return [];
    return chat.participants.map(p => p.toString());
  } catch (error) {
    console.error("Error getting chat participants:", error);
    return [];
  }
};