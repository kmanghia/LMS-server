import mongoose, { Document, Model, Schema } from "mongoose";
import { IUser } from "./user.model";

// Định nghĩa schema cho huy hiệu
export interface IBadge extends Document {
  name: string;
  description: string;
  imageUrl: string; 
  level: string; // bronze, silver, gold, platinum, diamond, master
  pointsRequired: number;
}

export const badgeSchema = new Schema<IBadge>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    imageUrl: { type: String, required: true },
    level: { 
      type: String, 
      required: true,
      enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond']
    },
    pointsRequired: { type: Number, required: true }
  },
  { timestamps: true }
);

// Schema cho điểm số và lịch sử điểm
interface IPointHistory {
  date: Date;
  action: string;
  points: number;
}

export interface IUserGamification extends Document {
  user: IUser["_id"];
  badges: {
    badgeId: IBadge["_id"];
    dateEarned: Date;
  }[];
  points: {
    totalPoints: number;
    history: IPointHistory[];
  };
  level: number;
  rank: number;
}

export const userGamificationSchema = new Schema<IUserGamification>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    badges: [
      {
        badgeId: { type: Schema.Types.ObjectId, ref: "Badge" },
        dateEarned: { type: Date, default: Date.now }
      }
    ],
    points: {
      totalPoints: { type: Number, default: 0 },
      history: [
        {
          date: { type: Date, default: Date.now },
          action: { type: String, required: true },
          points: { type: Number, required: true }
        }
      ]
    },
    level: { type: Number, default: 1 },
    rank: { type: Number, default: 0 }
  },
  { timestamps: true }
);

// Tạo models từ schemas
export const Badge: Model<IBadge> = mongoose.model("Badge", badgeSchema);
export const UserGamification: Model<IUserGamification> = mongoose.model("UserGamification", userGamificationSchema);