import express from "express";
import { authorizeRoles, isAutheticated } from "../middleware/auth";
import { 
  getNotifications, 
  updateNotification, 
  getUserNotifications, 
  getMentorNotifications 
} from "../controllers/notification.controller";

const notificationRoute = express.Router();

// Admin routes
notificationRoute.get(
  "/get-all-notifications",
  isAutheticated,
  authorizeRoles("admin"),
  getNotifications
);

// User routes
notificationRoute.get(
  "/user-notifications",
  isAutheticated,
  getUserNotifications
);

// Mentor routes
notificationRoute.get(
  "/mentor-notifications",
  isAutheticated,
  authorizeRoles("mentor"),
  getMentorNotifications
);

// Common routes
notificationRoute.put(
  "/update-notification/:id", 
  isAutheticated, 
  updateNotification
);

export default notificationRoute;
