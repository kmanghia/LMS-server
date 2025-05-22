import express from "express";
import { 
  getCertificateById, 
  getUserCertificates, 
  createCertificate, 
  verifyCertificate 
} from "../controllers/certificate.controller";
import { authorizeRoles, isAutheticated } from "../middleware/auth";

const router = express.Router();

// User routes
router.get("/get-user-certificates", isAutheticated, getUserCertificates);
router.get("/get-certificate/:certificateId", isAutheticated, getCertificateById);

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