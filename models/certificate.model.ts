import mongoose, { Document, Model, Schema } from "mongoose";

export interface ICertificate extends Document {
  userId: mongoose.Schema.Types.ObjectId;
  courseId: mongoose.Schema.Types.ObjectId;
  issueDate: Date;
  userNameAtIssue: string;
  courseNameAtIssue: string;
  mentorNameAtIssue: string;
}

const certificateSchema = new Schema<ICertificate>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    issueDate: {
      type: Date,
      default: Date.now,
    },
    userNameAtIssue: {
      type: String,
      required: true,
    },
    courseNameAtIssue: {
      type: String,
      required: true,
    },
    mentorNameAtIssue: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const CertificateModel: Model<ICertificate> = mongoose.model("Certificate", certificateSchema);

export default CertificateModel; 