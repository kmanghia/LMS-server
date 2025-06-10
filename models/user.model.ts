require("dotenv").config();
import mongoose, { Document, Model, Schema } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { courseSchema, ICourse } from "./course.model";

const emailRegexPattern: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
courseSchema
export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  avatar: {
    url: string;
  };
  role: string;
  isVerified: boolean;
  courses: Array<{ courseId: string }>;
  cart: Array<{ courseId: string }>;
  notes?: Array<{
    courseId: string,
    courseDataId: string,
    note: Array<{
      subject: string,
      content: string
    }>
  }>
  progress?: Array<{
    courseId: string,
    chapters: Array<{
      chapterId: string,
      isCompleted: boolean,
      lastActivityAt?: Date
    }>
  }>;
  comparePassword: (password: string) => Promise<boolean>;
  SignAccessToken: () => string;
  SignRefreshToken: () => string;
}
const userSchema: Schema<IUser> = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Vui lòng nhập tên của bạn"],
    },
    email: {
      type: String,
      required: [true, "Vui lòng nhập email của bạn"],
      validate: {
        validator: function (value: string) {
          return emailRegexPattern.test(value);
        },
        message: "Vui lòng nhập email hợp lệ",
      },
      unique: true,
    },
    password: {
      type: String,
      minlength: [6, "Mật khẩu phải chứa ít nhất 6 kí tự"],
      select: false,
    },
    avatar: {
      url: String,
    },
    role: {
      type: String,
      enum: ["user", "admin", "mentor"],
      default: "user",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    courses: [
      {
        courseId: String,
      },
    ],
    cart: [
      {
        courseId: String,
      },
    ],
    notes: [
      {
        courseId: {
          type: String,
          required: false,
        },
        courseDataId: {
          type: String,
          required: false,
        },
        note: [
          {
            subject: {
              type: String,
              required: false
            },
            content: {
              type: String,
              required: false
            }
          }
        ]
      }
    ],
    progress: [
      {
        courseId: {
          type: String,
          required: false,
        },
        chapters: [
          {
            chapterId: {
              type: String,
              required: false,
            },
            isCompleted: {
              type: Boolean,
              default: false,
            },
            lastActivityAt: {
              type: Date,
              
            },
          },
        ],
      },
    ],
  },
  { timestamps: true }
);


userSchema.pre<IUser>("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }
  this.password = await bcrypt.hash(this.password, 10);
  next();
});


userSchema.methods.SignAccessToken = function () {
  return jwt.sign({ id: this._id }, process.env.ACCESS_TOKEN || "", {
    expiresIn: "15m",
  });
};


userSchema.methods.SignRefreshToken = function () {
  return jwt.sign({ id: this._id }, process.env.REFRESH_TOKEN || "", {
    expiresIn: "3d",
  });
};


userSchema.methods.comparePassword = async function (
  enteredPassword: string
): Promise<boolean> {
  return await bcrypt.compare(enteredPassword, this.password);
};

const userModel: Model<IUser> = mongoose.model("User", userSchema);

export default userModel;
