import mongoose, { Document, Model, Schema } from "mongoose";

export interface IReviewReply {
  user_id: Schema.Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMentorReview extends Document {
  mentorId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
  replies: IReviewReply[];
}

const reviewMentorSchema = new Schema<IMentorReview>({
  mentorId: {
    type: Schema.Types.ObjectId,
    ref: "Mentor",
    required: true
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  comment: {
    type: String,
    required: true
  },
  replies: [
    {
      user_id: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
      },
      content: {
        type: String,
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      },
      updatedAt: {
        type: Date,
        default: Date.now
      }
    }
  ]
}, { timestamps: true });

// Create compound index for unique reviews per user per mentor
reviewMentorSchema.index({ mentorId: 1, userId: 1 }, { unique: true });

const MentorReviewModel: Model<IMentorReview> = mongoose.model("ReviewMentor", reviewMentorSchema);

export default MentorReviewModel; 