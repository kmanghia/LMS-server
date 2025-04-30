import express from "express";
import {
  activateUser,
  deleteUser,
  getAllUsers,
  getUserInfo,
  loginUser,
  logoutUser,
  registrationUser,
  socialAuth,
  // updateAccessToken,
  updatePassword,
  updateProfilePicture,
  updateUserInfo,
  updateUserRole,
  getProgessOfUser,
  markChapterAsCompleted,
  sendCertificateAfterCourse,

  getNotesByCourseDataIdOfUser,
  createNoteByCourseDataIdOfUser,
  deleteSingleNoteInNoteByCourseDataIdOfUser,
  updateSingleNoteInNoteByCourseDataIdOfUser
} from "../controllers/user.controller";
import { authorizeRoles, isAutheticated } from "../middleware/auth";
import { upload } from "../utils/multer";
const userRouter = express.Router();

userRouter.post("/registration", registrationUser);

userRouter.post("/activate-user", activateUser);

userRouter.post("/login", loginUser);

userRouter.get("/logout", isAutheticated, logoutUser);

userRouter.get("/me", isAutheticated, getUserInfo);

// userRouter.get("/refresh", updateAccessToken);

userRouter.post("/social-auth", socialAuth);

userRouter.put("/update-user-info", isAutheticated, updateUserInfo);

userRouter.put("/update-user-password", isAutheticated, updatePassword);

userRouter.put("/update-user-avatar", isAutheticated, upload.single('avatar') as any, updateProfilePicture);

userRouter.get(
  "/get-users",
  isAutheticated,
  authorizeRoles("admin"),
  getAllUsers
);

userRouter.put(
  "/update-user",
  isAutheticated,
  authorizeRoles("admin"),
  updateUserRole
);

userRouter.delete(
  "/delete-user/:id",
  isAutheticated,
  authorizeRoles("admin"),
  deleteUser
);


userRouter.get(
  "/user/progress",
  isAutheticated,
  getProgessOfUser
)

userRouter.put(
  "/user/mark-chapter",
  isAutheticated,
  markChapterAsCompleted
)

userRouter.post(
  "/user/get-certificate",
  isAutheticated,
  sendCertificateAfterCourse
)

// NOTES
userRouter.get(
  "/user/get-list-notes",
  isAutheticated,
  getNotesByCourseDataIdOfUser
)

userRouter.post(
  "/user/create-note-by-courseDataId",
  isAutheticated,
  createNoteByCourseDataIdOfUser
)

userRouter.delete(
  "/user/delete-single-note-id-in-note",
  isAutheticated,
  deleteSingleNoteInNoteByCourseDataIdOfUser
)

userRouter.put(
  "/user/update-single-note-id-in-note",
  isAutheticated,
  updateSingleNoteInNoteByCourseDataIdOfUser
)
export default userRouter;
