import mongoose, {Document,Model,Schema}  from "mongoose";

export interface INotification extends Document{
   title: string;
   message: string;
   status: string;
   userId: string;
   recipientRole: string; // Vai trò người nhận: "user", "mentor", "admin"
   sender: string; // ID người gửi thông báo (nếu có)
   courseId: string; // ID khóa học liên quan (nếu có)
   type: string; // Loại thông báo: "purchase", "update", "review", "discussion", "system", etc.
   link: string; // Đường dẫn khi click vào thông báo (nếu có)
}

const notificationSchema = new Schema<INotification>({
    title:{
        type: String,
        required: true
    },
    message:{
        type:String,
        required: true,
    },
    status:{
        type: String,
        required: true,
        default: "unread"
    },
    userId:{
        type: String,
        required: false
    },
    recipientRole:{
        type: String,
        enum: ["user", "mentor", "admin", "all"],
        required: true
    },
    sender:{
        type: String,
        required: false
    },
    courseId:{
        type: String,
        required: false
    },
    type:{
        type: String,
        enum: ["purchase", "update", "review", "discussion", "system", "course", "other"],
        default: "system",
        required: true
    },
    link:{
        type: String,
        required: false
    }
},{timestamps: true});


const NotificationModel: Model<INotification> = mongoose.model('Notification',notificationSchema);

export default NotificationModel;