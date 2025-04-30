require("dotenv").config();
import { Request, Response, NextFunction } from "express";
import userModel, { IUser } from "../models/user.model";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import ejs from "ejs";
import path from "path";
import {
  sendMail,
  sendMailCertificate
} from "../utils/sendMail";
import { sendToken } from "../utils/jwt";
import { redis } from "../utils/redis";
import {
  getAllUsersService,
  getUserById,
  updateUserRoleService,
} from "../services/user.service";
import cloudinary from "cloudinary";
import { uploadBase64ToS3, deleteFile } from '../utils/s3';
import fs from "fs"
import { createNotification } from "./notification.controller";
import CourseModel from "../models/course.model";

interface IRegistrationBody {
  name: string;
  email: string;
  password: string;
  avatar?: string;
}
export const registrationUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password } = req.body;

      const isEmailExist = await userModel.findOne({ email });
      if (isEmailExist) {
        return next(new ErrorHandler("Email đã tồn tại", 400));
      }
      const user: IRegistrationBody = {
        name,
        email,
        password,
      };

      const activationToken = createActivationToken(user);

      const activationCode = activationToken.activationCode;

      const data = { user: { name: user.name }, activationCode };
      const html = await ejs.renderFile(
        path.join(__dirname, "../mails/activation-mail.ejs"),
        data
      );

      try {
        console.log(user);
        await sendMail({
          email: user.email,
          subject: "Kích hoạt tài khoản của bạn",
          template: "activation-mail.ejs",
          data,
        });

        return res.status(201).json({
          success: true,
          message: `Vui lòng kiểm tra tài khoản của bạn: ${user.email} để kích hoạt tài khoản!`,
          activationToken: activationToken.token,
        });
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

interface IActivationToken {
  token: string;
  activationCode: string;
}

export const createActivationToken = (user: any): IActivationToken => {
  const activationCode = Math.floor(1000 + Math.random() * 9000).toString();

  const token = jwt.sign(
    {
      user,
      activationCode,
    },
    process.env.ACTIVATION_SECRET as Secret,
    {
      expiresIn: "5m",
    }
  );

  return { token, activationCode };
};


interface IActivationRequest {
  activation_token: string;
  activation_code: string;
}

export const activateUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { activation_token, activation_code } =
        req.body as IActivationRequest;

      const newUser: { user: IUser; activationCode: string } = jwt.verify(
        activation_token,
        process.env.ACTIVATION_SECRET as string
      ) as { user: IUser; activationCode: string };

      if (newUser.activationCode !== activation_code) {
        return next(new ErrorHandler("Mã kích hoạt không hợp lệ", 400));
      }

      const { name, email, password } = newUser.user;

      const existUser = await userModel.findOne({ email });

      if (existUser) {
        return next(new ErrorHandler("Email đã tồn tại", 400));
      }
      const user = await userModel.create({
        name,
        email,
        password,
      });

      res.status(201).json({
        success: true,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


interface ILoginRequest {
  email: string;
  password: string;
}

export const loginUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as ILoginRequest;
      console.log(email, password);
      if (!email || !password) {
        return next(new ErrorHandler("Vui lòng nhập email và password", 400));
      }

      const user = await userModel.findOne({ email }).select("+password");

      if (!user) {
        return next(new ErrorHandler("Email hoặc mật khẩu không hợp lệ", 400));
      }
      const isPasswordMatch = await user.comparePassword(password);
      if (!isPasswordMatch) {
        return next(new ErrorHandler("Email hoặc mật khẩu không hợp lệ", 400));
      }
      sendToken(user, 200, res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


export const logoutUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.cookie("access_token", "", { maxAge: 1 });
      res.cookie("refresh_token", "", { maxAge: 1 });
      const userId = req.user?._id || "";
      redis.del(userId);
      res.status(200).json({
        success: true,
        message: "Đăng xuất thành công",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


export const updateAccessToken = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refresh_token = req.headers["refresh-token"] as string;
      const decoded = jwt.verify(
        refresh_token,
        process.env.REFRESH_TOKEN as string
      ) as JwtPayload;

      const message = "Không thể làm mới mã thông báo";
      if (!decoded) {
        return next(new ErrorHandler(message, 400));
      }
      const session = await redis.get(decoded.id as string);

      if (!session) {
        return next(
          new ErrorHandler("Vui lòng đăng nhập để truy cập tài nguyên này!", 400)
        );
      }

      const user = JSON.parse(session);

      req.user = user;

      await redis.set(user._id, JSON.stringify(user), "EX", 604800); // 7days

      return next();
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


export const getUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      getUserById(userId, res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

interface ISocialAuthBody {
  email: string;
  name: string;
  avatar: string;
}


export const socialAuth = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, name, avatar } = req.body as ISocialAuthBody;
      const user = await userModel.findOne({ email });
      if (!user) {
        const newUser = await userModel.create({ email, name, avatar });
        sendToken(newUser, 200, res);
      } else {
        sendToken(user, 200, res);
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


interface IUpdateUserInfo {
  name?: string;
  email?: string;
}

export const updateUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.body as IUpdateUserInfo;

      const userId = req.user?._id;
      const user = await userModel.findById(userId);

      if (name && user) {
        user.name = name;
      }

      await user?.save();

      await redis.set(userId, JSON.stringify(user));

      res.status(201).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


interface IUpdatePassword {
  oldPassword: string;
  newPassword: string;
}

export const updatePassword = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { oldPassword, newPassword } = req.body as IUpdatePassword;

      if (!oldPassword || !newPassword) {
        return next(new ErrorHandler("Vui lòng nhập mật khẩu cũ và mới", 400));
      }

      const user = await userModel.findById(req.user?._id).select("+password");

      if (user?.password === undefined) {
        return next(new ErrorHandler("Người dùng không hợp lệ", 400));
      }

      const isPasswordMatch = await user?.comparePassword(oldPassword);

      if (!isPasswordMatch) {
        return next(new ErrorHandler("Mật khẩu cũ không hợp lệ", 400));
      }

      user.password = newPassword;

      await user.save();

      await redis.set(req.user?._id, JSON.stringify(user));

      res.status(201).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

interface IUpdateProfilePicture {
  avatar: string;
}


export const updateProfilePicture = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // const { avatar } = req.body as IUpdateProfilePicture;

      const userId = req.user?._id;

      const user = await userModel.findById(userId).select("+password");

      const image = req.file;

      if (user) {

        if (user?.avatar?.url) {

          const oldImagePath = path.join(__dirname, '../uploads/images', user?.avatar?.url);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
            console.log('Đã xóa ảnh cũ:', oldImagePath);
          }
          user.avatar = {
            url: image?.filename as any,
          };

        } else {
          user.avatar = {
            url: image?.filename as any,
          };
        }
      }

      await user?.save();

      await redis.set(userId, JSON.stringify(user));
      console.log(user?.avatar.url);
      res.status(200).json({
        success: true,
        user,
      });
    } catch (error: any) {
      console.log(error);
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


export const getAllUsers = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      getAllUsersService(res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


export const updateUserRole = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, role } = req.body;
      const isUserExist = await userModel.findOne({ email });
      if (isUserExist) {
        const id = isUserExist._id;
        updateUserRoleService(res, id, role);
      } else {
        res.status(400).json({
          success: false,
          message: "Không tìm thấy người dùng",
        });
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


export const deleteUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const user = await userModel.findById(id);

      if (!user) {
        return next(new ErrorHandler("Không tìm thấy người dùng", 404));
      }

      await user.deleteOne({ id });

      await redis.del(id);

      res.status(200).json({
        success: true,
        message: "Người dùng đã xóa thành công",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


// ======================================= CHAPTER =======================================
export const getProgessOfUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.user?._id;
      const response = await userModel.findById(id).select('progress');
      res.status(200).json({
        success: true,
        response: response
      })
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
)

export const markChapterAsCompletedOfUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.user?._id;
      const chapterId = req.query.chapterId;
      const courseId = req.query.courseId;
      const user = await userModel.findById(id);
      const progresses = user?.progress;
      const courseProgress = progresses?.find(item => item.courseId.toString() === courseId);
      let chapterCourse = courseProgress?.chapters.find(item => item.chapterId.toString() === chapterId);
      if (chapterCourse) {
        chapterCourse.isCompleted = true;
      }
      await user?.save();
      res.status(200).json({
        success: true,
        response: chapterCourse
      })
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
)

export const sendCertificateAfterCourse = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      const { courseId, courseName } = req.body;
      const mailData = {
        course: courseName,
        name: user?.name,
        date: new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      };

      try {
        if (user) {
          await sendMailCertificate({
            email: user?.email,
            subject: "Certificate of Completion",
            template: "send-certification.ejs",
            data: mailData,
          });
        }
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
      }

      res.status(201).json({
        succcess: true
      })
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
)

// ======================================= NOTES =======================================
export const getNotesByCourseDataIdOfUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      const { courseId, courseDataId } = req.query;
      const user = await userModel.findById(userId).select('notes');
      if (!user?.notes) {
        return next(new ErrorHandler("Không tìm thấy danh sách ghi chú", 400));
      }
      const response = user.notes.find(note => note.courseId === courseId && note.courseDataId === courseDataId);
      res.status(200).json({
        success: true,
        response: response
      })
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
)

export const createNoteByCourseDataIdOfUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      const { courseId, courseDataId, subject, content } = req.body;
      const user = await userModel.findById(userId).select('notes');
      if (!user?.notes) {
        return next(new ErrorHandler("Không tìm thấy danh sách ghi chú", 400));
      }

      let note: any = user.notes.find(note => note.courseId === courseId && note.courseDataId === courseDataId);
      if (!note) {
        note = {
          courseId: courseId,
          courseDataId: courseDataId,
          note: []
        };
        const singleNote = {
          subject: subject,
          content: content
        }
        note.note.push(singleNote);
        const notesFilter = user.notes.filter(note => note.courseDataId !== courseDataId);
        user.notes = [...notesFilter, note]
        await user.save();
      } else {
        let singleNote = {
          subject: subject,
          content: content
        }
        let _singleNoteHaveId = {
          courseId: courseId,
          courseDataId: courseDataId,
          note: [...note.note]
        }
        _singleNoteHaveId.note.push(singleNote);
        const notesFilter = user.notes.filter(note => note.courseDataId !== courseDataId);
        user.notes = [...notesFilter, _singleNoteHaveId];
        await user.save();
      }
      res.status(200).json({
        success: true
      })
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
)

export const deleteSingleNoteInNoteByCourseDataIdOfUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      const { courseId, courseDataId, singleNoteIdInNote } = req.query;
      const user = await userModel.findById(userId).select('notes');
      if (!user?.notes) {
        return next(new ErrorHandler("Không tìm thấy danh sách ghi chú", 400));
      }

      const targetNote = user.notes.find(note => note.courseId === courseId && note.courseDataId === courseDataId);

      if (targetNote) {
        let _cloneNote = targetNote.note.filter((item: any) => item._id.toString() !== singleNoteIdInNote);
        let _cloneNoteOfNote = [..._cloneNote];
        let _cloneNotes = user.notes.filter(note => note.courseDataId !== courseDataId);
        _cloneNotes.push({
          courseId: courseId,
          courseDataId: courseDataId,
          note: _cloneNoteOfNote
        } as any)
        user.notes = _cloneNotes;
        await user.save();
      }
      res.status(200).json({
        success: true,
        // response: response
      })
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
)

export const updateSingleNoteInNoteByCourseDataIdOfUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      const { courseId, courseDataId, subject, content, singleNoteId } = req.body;
      const user = await userModel.findById(userId).select('notes');
      if (!user) {
        return next(new ErrorHandler("Không tồn tại danh sách ghi chú", 400));
      }
      const targetNotes = user.notes?.find(item => item.courseId === courseId && item.courseDataId === courseDataId);
      if (targetNotes) {
        const index = targetNotes.note.findIndex((item: any) => item._id.toString() === singleNoteId);
        if (index > -1) {
          targetNotes.note[index].subject = subject;
          targetNotes.note[index].content = content;
        }
        let _cloneNotes = user.notes?.filter(item => item.courseDataId !== targetNotes.courseDataId);
        _cloneNotes?.push(targetNotes);
        user.notes = _cloneNotes;
        await user.save();
      }
      res.status(200).json({
        success: true,
        targetNotes
      })
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
)