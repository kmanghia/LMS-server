import express from "express";
import { 
  getCertificateById, 
  getUserCertificates, 
  createCertificate, 
  verifyCertificate, 
  getUserCertificatesForCourseByQuery
} from "../controllers/certificate.controller";
import { authorizeRoles, isAutheticated } from "../middleware/auth";

const router = express.Router();

// User routes
router.get("/get-user-certificates", isAutheticated, getUserCertificates);
router.get("/get-certificate/:certificateId", isAutheticated, getCertificateById);
router.get("/get-user-certificates-by-courseId/:courseId", isAutheticated, getUserCertificatesForCourseByQuery);
// Admin routes
router.post(
  "/create-certificate", 
  isAutheticated, 
  authorizeRoles("admin"), 
  createCertificate
);

// Public routes
router.get("/verify/:certificateId", verifyCertificate);

export default router; 