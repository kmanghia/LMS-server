import mongoose, { Document, Model, Schema } from "mongoose";

interface IOwnerQuizz extends Document {
    userId: string;
    courseId: string;
    lessonId: string;
    scored: number;
    selected_options: object;  // Đảm bảo tên trùng khớp với dữ liệu truyền vào
}

const IOwnerQuizzSchema = new Schema<IOwnerQuizz>({
    userId: { type: String, required: true },
    courseId: { type: String, required: true },
    lessonId: { type: String, required: true },
    scored: { type: Number, required: true },
    selected_options: { type: Object, required: true }  // Đảm bảo trùng với dữ liệu trong req.body
});

const quizzModel: Model<IOwnerQuizz> = mongoose.model<IOwnerQuizz>("Quizz", IOwnerQuizzSchema);
export default quizzModel;