import mongoose, { Document, Model, Schema } from "mongoose";
import { IUser } from "./user.model";
import { ICourse } from "./course.model";

// Định nghĩa đánh giá mentor từ học viên
export interface IMentorReview extends Document {
  user: IUser;
  rating: number;
  comment: string;
  createdAt: Date;
}

// Định nghĩa model mentor
export interface IMentor extends Document {
  user: Schema.Types.ObjectId; // Link tới user
  approved: boolean; // Trạng thái được duyệt bởi admin
  bio: string; // Thông tin giới thiệu 
  specialization: string[]; // Lĩnh vực chuyên môn
  experience: number; // Số năm kinh nghiệm
  achievements: string[]; // Thành tựu đạt được
  courses: Schema.Types.ObjectId[]; // Các khóa học đã tạo
  reviews: IMentorReview[]; // Đánh giá từ học viên
  averageRating: number; // Điểm đánh giá trung bình
  applicationStatus: string; // pending, approved, rejected
  applicationDate: Date; // Ngày đăng ký làm mentor
  createdAt: Date;
  updatedAt: Date;
}

// Schema đánh giá mentor
const mentorReviewSchema = new Schema<IMentorReview>({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Schema mentor
const mentorSchema = new Schema<IMentor>({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  approved: {
    type: Boolean,
    default: false
  },
  bio: {
    type: String,
    required: true
  },
  specialization: [{
    type: String,
    required: true
  }],
  experience: {
    type: Number,
    required: true
  },
  achievements: [{
    type: String
  }],
  courses: [{
    type: Schema.Types.ObjectId,
    ref: "Course"
  }],
  reviews: [mentorReviewSchema],
  averageRating: {
    type: Number,
    default: 0
  },
}, { timestamps: true });

const MentorModel: Model<IMentor> = mongoose.model("Mentor", mentorSchema);

export default MentorModel; 