import express from "express";
import { authorizeRoles, isAutheticated } from "../middleware/auth";
import { 
  addUserPoints, 
  getUserGamification, 
  getLeaderboard,
  createBadge,
  updateUserBadges
} from "../controllers/simplified-gamification.controller";
import { Badge, UserGamification } from "../models/gamification.model";
import UserModel from "../models/user.model";

const router = express.Router();

// Kiểm tra route mặc định để debug
router.get("/gamification-status", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Gamification system is working (simplified)"
  });
});

// Thêm một route debug không cần xác thực
router.get("/debug-gamification", async (req, res) => {
  try {
    // Kiểm tra các models
    const totalBadges = await Badge.countDocuments();
    const totalProfiles = await UserGamification.countDocuments();
    
    // Lấy danh sách badges để debug
    const badges = await Badge.find().sort({ pointsRequired: 1 });
    
    res.status(200).json({
      success: true,
      message: "Gamification debug info (simplified)",
      data: {
        totalBadges,
        totalProfiles,
        badges: badges.map(b => ({
          id: b._id,
          name: b.name,
          level: b.level,
          pointsRequired: b.pointsRequired
        })),
        routes: {
          getUserGamification: "/api/v1/gamification",
          addPoints: "/api/v1/gamification/points/add",
          leaderboard: "/api/v1/gamification/leaderboard",
          updateBadges: "/api/v1/gamification/update-badges"
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving debug info",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Thêm một route debug để kiểm tra dữ liệu gamification của người dùng cụ thể
router.get("/debug-gamification/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log('[DEBUG] Debug gamification for userId:', userId);
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }
    
    // Kiểm tra tồn tại của user
    const userExists = await UserModel.findById(userId).select('name email');
    if (!userExists) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Lấy dữ liệu gamification
    const userGamification = await UserGamification.findOne({ user: userId })
      .populate({
        path: 'badges.badgeId',
        model: 'Badge'
      });
    
    // Lấy danh sách badges
    const allBadges = await Badge.find().sort({ pointsRequired: 1 });
    
    // Tính toán badges người dùng đủ điều kiện nhận
    const userTotalPoints = userGamification?.points?.totalPoints || 0;
    const eligibleBadges = allBadges.filter(badge => badge.pointsRequired <= userTotalPoints);
    
    // Lấy danh sách ID badges người dùng đã có
    const userBadgeIds = userGamification?.badges?.map(b => b.badgeId?._id.toString() || '') || [];
    
    // Tìm badges người dùng đủ điều kiện nhưng chưa nhận
    const missedBadges = eligibleBadges.filter(badge => 
      !userBadgeIds.includes(badge._id.toString())
    );
    
    return res.status(200).json({
      success: true,
      userData: {
        user: userExists,
        hasGamificationProfile: !!userGamification
      },
      gamification: userGamification || "No gamification data",
      badges: {
        total: allBadges.length,
        userHas: userBadgeIds.length,
        eligible: eligibleBadges.length,
        missing: missedBadges.length,
        missedBadges: missedBadges.map(b => ({
          id: b._id,
          name: b.name,
          level: b.level,
          pointsRequired: b.pointsRequired
        }))
      }
    });
  } catch (error) {
    console.error('[ERROR] Error in debug-gamification:', error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving debug info",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Route để cập nhật lại badges dựa trên điểm số
router.post("/gamification/update-badges", isAutheticated, updateUserBadges);

// Routes cho người dùng
router.get("/gamification", isAutheticated, getUserGamification);
router.post("/gamification/points/add", isAutheticated, addUserPoints);
router.get("/gamification/leaderboard", isAutheticated, getLeaderboard);

// Routes cho admin
router.post("/admin/gamification/badge/create", isAutheticated, authorizeRoles("admin"), createBadge);

export default router; 