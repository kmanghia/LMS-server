import mongoose, { Document, Model, Schema } from "mongoose";
import { courseSchema, ICourse } from "./course.model";
import { IUser } from "./user.model";

export interface ICart extends Document {
    user: IUser,
    courses: ICourse[]
}

const cartSchema = new Schema<ICart>({
    user: {
        type: Object,
        required: true,
    },
    courses: {
        type: [courseSchema],
        required: true,
    },
}, { timestamps: true });

const CartModel: Model<ICart> = mongoose.model("Cart", cartSchema);

export default CartModel;