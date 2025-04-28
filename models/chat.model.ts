import mongoose, { Document, Model, Schema } from "mongoose";

export interface IMessage extends Document {
  sender: Schema.Types.ObjectId;
  content: string;
  readBy: Schema.Types.ObjectId[];
  createdAt: Date;
}

export interface IChat extends Document {
  name: string;
  chatType: string; // 'private' for 1:1 chats, 'course' for course group chats
  participants: Schema.Types.ObjectId[]; // User IDs
  courseId?: Schema.Types.ObjectId; // Only for course chats
  mentorId: Schema.Types.ObjectId; // The mentor associated with this chat
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>({
  sender: {
    type: Schema.Types.ObjectId, 
    ref: "User",
    required: true
  },
  content: {
    type: String,
    required: true
  },
  readBy: [{
    type: Schema.Types.ObjectId,
    ref: "User"
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const chatSchema = new Schema<IChat>({
  name: {
    type: String,
    required: function() {
      return this.chatType === 'course';
    }
  },
  chatType: {
    type: String,
    enum: ['private', 'course'],
    required: true
  },
  participants: [{
    type: Schema.Types.ObjectId,
    ref: "User"
  }],
  courseId: {
    type: Schema.Types.ObjectId,
    ref: "Course"
  },
  mentorId: {
    type: Schema.Types.ObjectId,
    ref: "Mentor",
    required: true
  },
  messages: [messageSchema]
}, { timestamps: true });

// Create indexes for query performance
chatSchema.index({ participants: 1 });
chatSchema.index({ courseId: 1 });
chatSchema.index({ mentorId: 1 });

const ChatModel: Model<IChat> = mongoose.model("Chat", chatSchema);

export default ChatModel; 