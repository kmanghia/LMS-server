require("dotenv").config();
import mongoose, { Document, Model, Schema } from "mongoose";



export interface IWishlist extends Document {
    userId: string;
    courseId: string;
}
const wishlistSchema: Schema<IWishlist> = new mongoose.Schema({
    userId: {
        type: String,
    },
    courseId: {
        type: String,
    }
});

const wishlistModel: Model<IWishlist> = mongoose.model("Wishlist", wishlistSchema);

export default wishlistModel;
