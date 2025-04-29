import { Server as SocketIOServer } from "socket.io";
import http from "http";
import ChatModel from "./models/chat.model";
import mongoose from "mongoose";

let io: SocketIOServer;
// Đổi cấu trúc Map để hỗ trợ nhiều kết nối từ cùng một userId
const connectedUsers = new Map<string, Map<string, string>>(); // userId -> Map<clientId, socketId>

export const initSocketServer = (server: http.Server) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: "*", // In production, specify trusted origins
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);
    let currentUserId: string | null = null;
    let currentClientId: string | null = null;

    // Authenticate user and track their socket
    socket.on("authenticate", (data: { userId: string, clientType?: string, clientId?: string } | string) => {
      let userId: string;
      let clientId: string = "default";
      let clientType: string = "unknown";
      
      // Hỗ trợ cả format cũ và mới
      if (typeof data === 'string') {
        userId = data;
        clientId = `legacy_${socket.id}`;
      } else {
        userId = data.userId;
        clientId = data.clientId || `default_${socket.id}`;
        clientType = data.clientType || "unknown";
      }

      if (userId) {
        currentUserId = userId;
        currentClientId = clientId;
        
        console.log(`User ${userId} authenticated with socket ${socket.id} (Client: ${clientType}, ID: ${clientId})`);
        
        // Add user to connected users map with clientId
        socket.join(`user:${userId}`);
        
        // Kiểm tra xem userId đã tồn tại trong map chưa
        if (!connectedUsers.has(userId)) {
          connectedUsers.set(userId, new Map());
        }
        
        // Lưu socketId cho clientId cụ thể của userId này
        connectedUsers.get(userId)!.set(clientId, socket.id);
        
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
        const { chatId, message, senderId, clientId, attachments } = data;
        
        if (!chatId || !message || !senderId) {
          socket.emit("messageError", { message: "cannot send message missing data" });
          return;
        }

        // Ghi log thông tin client để debug
        console.log(`Processing message from senderId: ${senderId}, clientId: ${clientId || 'not provided'}`);

        // Add message to database
        const chat = await ChatModel.findById(chatId);
        if (!chat) {
          socket.emit("messageError", { message: "chat not found" });
          return;
        }

        // Create message object with attachments if provided
        const messageObj: any = {
          sender: new mongoose.Types.ObjectId(senderId),
          content: message,
          readBy: [new mongoose.Types.ObjectId(senderId)],
          createdAt: new Date()
        };
        
        // Add attachments if provided
        if (attachments && Array.isArray(attachments) && attachments.length > 0) {
          messageObj.attachments = attachments;
        }
        
        chat.messages.push(messageObj);
        
        await chat.save();

        // Get the newly added message with its generated _id
        const savedMessage = chat.messages[chat.messages.length - 1];

        // Broadcast to all users in the chat room
        io.to(`chat:${chatId}`).emit("newMessage", {
          chatId,
          message: savedMessage
        });

        // Phản hồi trực tiếp cho client gửi tin nhắn
        socket.emit("messageSent", {
          success: true,
          messageId: savedMessage._id
        });

        // Send push notifications to offline users
        chat.participants.forEach(participantId => {
          const participantIdStr = participantId.toString();
          if (participantIdStr !== senderId) {
            // Kiểm tra xem có bất kỳ kết nối nào của người dùng này
            if (!connectedUsers.has(participantIdStr) || connectedUsers.get(participantIdStr)!.size === 0) {
              // User is completely offline - would send push notification
              console.log(`User ${participantIdStr} is offline. Send push notification.`);
            }
          }
        });
      } catch (error) {
        console.error("Error processing message:", error);
        socket.emit("messageError", { message: "server error processing message" });
      }
    });

    // Handle typing indicators
    socket.on("typing", (data) => {
      const { chatId, userId, isTyping, clientId } = data;
      console.log(`Typing indicator from userId: ${userId}, clientId: ${clientId || 'not provided'}`);
      
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
      
      // Chỉ xóa client ID cụ thể nếu có thông tin user
      if (currentUserId && currentClientId) {
        const userConnections = connectedUsers.get(currentUserId);
        
        if (userConnections) {
          // Xóa kết nối cụ thể cho clientId này
          userConnections.delete(currentClientId);
          
          // Nếu không còn kết nối nào cho user này, xóa hoàn toàn và báo offline
          if (userConnections.size === 0) {
            connectedUsers.delete(currentUserId);
            io.emit("userStatusChanged", { userId: currentUserId, status: "offline" });
            console.log(`User ${currentUserId} is now offline (no more active connections)`);
          } else {
            console.log(`User ${currentUserId} still has ${userConnections.size} active connections`);
          }
        }
      } else {
        // Phương pháp fallback cho những kết nối không xác thực
        // Tìm và xóa kết nối theo socketId
        for (const [userId, clients] of connectedUsers.entries()) {
          for (const [clientId, socketId] of clients.entries()) {
            if (socketId === socket.id) {
              clients.delete(clientId);
              
              if (clients.size === 0) {
                connectedUsers.delete(userId);
                io.emit("userStatusChanged", { userId, status: "offline" });
                console.log(`User ${userId} is now offline`);
              }
              
              break;
            }
          }
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
  return connectedUsers.has(userId) && connectedUsers.get(userId)!.size > 0;
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