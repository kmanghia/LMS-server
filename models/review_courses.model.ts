import mongoose, { Document, Model, Schema } from "mongoose";

export interface IReviewReply {
  user_id: Schema.Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICourseReview extends Document {
  courseId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
  replies: IReviewReply[];
}

const reviewCourseSchema = new Schema<ICourseReview>({
  courseId: {
    type: Schema.Types.ObjectId,
    ref: "Course",
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

// Create compound index for unique reviews per user per course
reviewCourseSchema.index({ courseId: 1, userId: 1 }, { unique: true });

const CourseReviewModel: Model<ICourseReview> = mongoose.model("ReviewCourse", reviewCourseSchema);

export default CourseReviewModel; 