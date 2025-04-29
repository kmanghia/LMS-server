import mongoose, { Document, Model, Schema } from "mongoose";

export interface IAttachment {
  [x: string]: any;
  type: string; // 'image', 'document', 'video', etc.
  url: string;
  filename: string;
  mimeType: string;
  size?: number;
  thumbnailUrl?: string; 
}

export interface IMessage extends Document {
  sender: Schema.Types.ObjectId;
  content: string;
  readBy: Schema.Types.ObjectId[];
  createdAt: Date;
  attachments?: IAttachment[]; 
}

export interface IChat extends Document {
  name: string;
  chatType: string; 
  participants: Schema.Types.ObjectId[]; 
  courseId?: Schema.Types.ObjectId; 
  mentorId: Schema.Types.ObjectId; 
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema<IAttachment>({
  type: {
    type: String,
    required: true,
    enum: ['image', 'document', 'video', 'audio', 'other']
  },
  url: {
    type: String,
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number
  },
  thumbnailUrl: {
    type: String
  }
});

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
  attachments: [attachmentSchema], 
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


chatSchema.index({ participants: 1 });
chatSchema.index({ courseId: 1 });
chatSchema.index({ mentorId: 1 });

const ChatModel: Model<IChat> = mongoose.model("Chat", chatSchema);

export default ChatModel; 