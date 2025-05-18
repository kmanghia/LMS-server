import mongoose, { Document, Model, Schema } from "mongoose";
import { IUser } from "./user.model";

export interface IComment extends Document {
  user: IUser;
  question: string;
  questionReplies: IComment[];
  isPinned: boolean;
}

export interface IReview extends Document {
  user: IUser;
  rating?: number;
  comment: string;
  commentReplies?: IReview[];
}

interface ILink extends Document {
  title: string;
  url: string;
}

interface IQuizz extends Document {
  question: string;
  questionImage?: {
    url: string;
  };
  options: string[];
  correctAnswer: string;
}

interface ICourseData extends Document {
  title: string;
  description: string;
  videoUrl: string;
  videoThumbnail: object;
  videoSection: string;
  videoLength: number;
  videoPlayer: string;
  links: ILink[];
  suggestion: string;
  iquizz: IQuizz[];
  questions: IComment[];
}

export interface ICourse extends Document {
  name: string;
  description: string;
  categories: string;
  price: number;
  estimatedPrice?: number;
  thumbnail: object;
  tags: string;
  level: string;
  demoUrl: string;
  benefits: { title: string }[];
  prerequisites: { title: string }[];
  reviews: IReview[];
  courseData: ICourseData[];
  ratings?: number;
  purchased: number;
  mentor: Schema.Types.ObjectId;
  status: string;
  isFree: boolean;
}

const reviewSchema = new Schema<IReview>({
  user: Object,
  rating: {
    type: Number,
    default: 0,
  },
  comment: String,
  commentReplies: [Object],
}, { timestamps: true });

const linkSchema = new Schema<ILink>({
  title: String,
  url: String,
});

const iquizzSchema = new Schema<IQuizz>({
  question: String, // Không bắt buộc
  questionImage: {
    url: String
  },
  options: [String], // Không bắt buộc
  correctAnswer: String, // Không bắt buộc
});

const questionSchema = new Schema<IComment>({
  user: Object,
  question: String,
  questionReplies: [Object],
  isPinned: {
    type: Boolean,
    default: false
  },
}, { timestamps: true });

const courseDataSchema = new Schema<ICourseData>({
  videoUrl: String,
  videoThumbnail: Object,
  title: String,
  videoSection: String,
  description: String,
  videoLength: Number,
  videoPlayer: String,
  links: [linkSchema],
  suggestion: String,
  iquizz: [iquizzSchema], // Không bắt buộc
  questions: [questionSchema],
});

export const courseSchema = new Schema<ICourse>({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  categories: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  estimatedPrice: {
    type: Number,
  },
  thumbnail: {
    url: {
      type: String,
    },
  },
  tags: {
    type: String,
    required: true,
  },
  level: {
    type: String,
    required: true,
  },
  demoUrl: {
    type: String,
    required: true,
  },
  benefits: [{ title: String }],
  prerequisites: [{ title: String }],
  reviews: [reviewSchema],
  courseData: [courseDataSchema],
  ratings: {
    type: Number,
    default: 0,
  },
  purchased: {
    type: Number,
    default: 0,
  },
  mentor: {
    type: Schema.Types.ObjectId,
    ref: "Mentor"
  },
  status: {
    type: String,
    enum: ["draft", "pending", "active", "rejected"],
    default: "draft"
  },
  isFree: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });


const CourseModel: Model<ICourse> = mongoose.model("Course", courseSchema);

export default CourseModel;
