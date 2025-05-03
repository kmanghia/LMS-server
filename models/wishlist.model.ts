require("dotenv").config();
import mongoose, { Document, Model, Schema } from "mongoose";

export interface IWishlist extends Document {
    userId: string;
    courseId: string;
    lessonId?: string;
    type: 'course' | 'lesson';
    createdAt: Date;
}

const wishlistSchema: Schema<IWishlist> = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    courseId: {
        type: String,
        required: true
    },
    lessonId: {
        type: String,
        required: false
    },
    type: {
        type: String,
        enum: ['course', 'lesson'],
        required: true,
        default: 'course'
    }
}, { timestamps: true });

// Tạo index để tìm kiếm nhanh và tránh trùng lặp
wishlistSchema.index({ userId: 1, courseId: 1, lessonId: 1, type: 1 }, { unique: true });

const wishlistModel: Model<IWishlist> = mongoose.model("Wishlist", wishlistSchema);

export default wishlistModel;
