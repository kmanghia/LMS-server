import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import { Badge, UserGamification } from "../models/gamification.model";

// Thêm điểm cho người dùng khi hoàn thành bài học/khóa học
export const addUserPoints = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { points, action } = req.body;
    const userId = req.user?._id;
    console.log('[DEBUG] addUserPoints - userId:', userId);
    console.log('[DEBUG] addUserPoints - points:', points, 'action:', action);
    
    if (!points || !action) {
      console.log('[DEBUG] Missing points or action');
      return next(new ErrorHandler("Points and action are required", 400));
    }
    
    // Tìm hoặc tạo profile gamification cho người dùng
    let userGamification = await UserGamification.findOne({ user: userId });
    console.log('[DEBUG] userGamification found:', userGamification ? 'Yes' : 'No');
    
    if (!userGamification) {
      console.log('[DEBUG] Creating new userGamification record');
      userGamification = await UserGamification.create({
        user: userId,
        points: {
          totalPoints: 0,
          history: []
        },
        badges: [],
        level: 1,
        rank: 0
      });
      console.log('[DEBUG] New userGamification created:', userGamification._id);
    }
    
    // Cập nhật điểm
    userGamification.points.totalPoints += points;
    console.log('[DEBUG] Updated points:', {
      totalPoints: userGamification.points.totalPoints
    });
    
    // Thêm vào lịch sử điểm
    userGamification.points.history.push({
      date: new Date(),
      action,
      points
    });
    
    // Cập nhật level dựa trên tổng điểm
    userGamification.level = calculateLevel(userGamification.points.totalPoints);
    console.log('[DEBUG] Updated level to:', userGamification.level);
    
    await userGamification.save();
    console.log('[DEBUG] Saved userGamification with updated points');
    
    // Cấp huy hiệu dựa trên điểm nếu đạt milestone
    await checkAndAwardBadges(userId, userGamification.points.totalPoints);
    
    return res.status(200).json({
      success: true,
      points: userGamification.points,
      level: userGamification.level
    });
  } catch (error: any) {
    console.error('[ERROR] addUserPoints error:', error.message);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Lấy thông tin gamification của người dùng
export const getUserGamification = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?._id;
    console.log('[DEBUG] getUserGamification - userId:', userId);
    
    if (!userId) {
      console.log('[ERROR] getUserGamification - No userId found in request');
      return next(new ErrorHandler("User ID not found in request", 401));
    }
    
    let userGamification = await UserGamification.findOne({ user: userId })
      .populate({
        path: 'badges.badgeId',
        model: 'Badge'
      })
      .populate({
        path: 'user',
        model: 'User',
        select: 'name email avatar'
      });
    
    console.log('[DEBUG] userGamification found:', userGamification ? 'Yes' : 'No');
    
    if (!userGamification) {
      console.log('[DEBUG] Creating new userGamification record');
      userGamification = await UserGamification.create({
        user: userId,
        badges: [],
        points: {
          totalPoints: 0,
          history: []
        },
        level: 1,
        rank: 0
      });
      console.log('[DEBUG] New userGamification created:', userGamification._id);
      
      // Thực hiện populate cho đối tượng mới tạo
      userGamification = await UserGamification.findOne({ user: userId })
        .populate({
          path: 'badges.badgeId',
          model: 'Badge'
        })
        .populate({
          path: 'user',
          model: 'User',
          select: 'name email avatar'
        });
    }
    
    return res.status(200).json({
      success: true,
      gamification: userGamification
    });
  } catch (error: any) {
    console.error('[ERROR] getUserGamification error:', error.message);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Lấy bảng xếp hạng
export const getLeaderboard = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit = 10 } = req.query;
    
    const leaderboard = await UserGamification.find()
      .populate('user', 'name avatar')
      .sort({ 'points.totalPoints': -1 })
      .limit(Number(limit))
      .select('user level points.totalPoints');
    
    return res.status(200).json({
      success: true,
      leaderboard
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Tạo huy hiệu mới (chỉ admin)
export const createBadge = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, imageUrl, level, pointsRequired } = req.body;
    
    if (!name || !description || !imageUrl || !level || !pointsRequired) {
      return next(new ErrorHandler("All badge fields are required", 400));
    }
    
    const badge = await Badge.create({
      name,
      description,
      imageUrl,
      level,
      pointsRequired
    });
    
    return res.status(201).json({
      success: true,
      badge
    });
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Tính toán cấp độ dựa trên tổng điểm
const calculateLevel = (totalPoints: number): number => {
  // Mỗi 100 điểm là 1 cấp độ (cấp độ 1 từ 0-99 điểm, cấp 2 từ 100-199, v.v.)
  return Math.floor(totalPoints / 100) + 1;
};

// Hàm kiểm tra và cấp huy hiệu dựa trên điểm
const checkAndAwardBadges = async (userId: string, totalPoints: number) => {
  try {
    console.log('[DEBUG] Running checkAndAwardBadges for userId:', userId, 'with totalPoints:', totalPoints);
    
    // Lấy các huy hiệu có điểm yêu cầu thấp hơn hoặc bằng tổng điểm của người dùng
    const eligibleBadges = await Badge.find({ 
      pointsRequired: { $lte: totalPoints } 
    });
    
    console.log('[DEBUG] Found eligible badges:', eligibleBadges.length);
    if (!eligibleBadges.length) {
      console.log('[DEBUG] No eligible badges found');
      return;
    }
    
    // Log thông tin các badges hợp lệ
    eligibleBadges.forEach((badge, index) => {
      console.log(`[DEBUG] Eligible badge ${index + 1}:`, {
        id: badge._id.toString(),
        name: badge.name,
        pointsRequired: badge.pointsRequired
      });
    });
    
    const userGamification = await UserGamification.findOne({ user: userId });
    if (!userGamification) {
      console.log('[DEBUG] User gamification not found');
      return;
    }
    
    // Khởi tạo badges nếu chưa có
    if (!userGamification.badges) {
      userGamification.badges = [];
    }
    
    console.log('[DEBUG] User current badges count:', userGamification.badges.length);
    
    // Danh sách ID các huy hiệu mà người dùng đã có
    const userBadgeIds = userGamification.badges.map(badge => {
      if (badge.badgeId) {
        return badge.badgeId.toString();
      }
      return '';
    }).filter(id => id !== '');
    
    console.log('[DEBUG] User existing badge IDs:', userBadgeIds);
    
    // Lọc ra các huy hiệu mà người dùng chưa có
    const newBadges = eligibleBadges.filter(badge => {
      const badgeId = badge._id.toString();
      const hasAlready = userBadgeIds.includes(badgeId);
      console.log(`[DEBUG] Badge ${badge.name} (ID: ${badgeId}) - Already owned: ${hasAlready}`);
      return !hasAlready;
    });
    
    console.log('[DEBUG] Found new badges to award:', newBadges.length);
    
    // Nếu không có huy hiệu mới, không làm gì cả
    if (!newBadges.length) {
      console.log('[DEBUG] No new badges to award');
      return;
    }
    
    // Thêm các huy hiệu mới vào cho người dùng
    for (const badge of newBadges) {
      console.log(`[DEBUG] Adding badge ${badge.name} (ID: ${badge._id}) to user`);
      userGamification.badges.push({
        badgeId: badge._id,
        dateEarned: new Date()
      });
    }
    
    console.log('[DEBUG] Saving user gamification with new badges');
    await userGamification.save();
    console.log('[DEBUG] Successfully saved user gamification with new badges');
    return newBadges;
  } catch (error) {
    console.error('[ERROR] Error in checkAndAwardBadges:', error);
    throw error;
  }
};

// Cập nhật huy hiệu cho người dùng dựa trên điểm hiện tại
export const updateUserBadges = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?._id;
    console.log('[DEBUG] updateUserBadges - userId:', userId);
    
    if (!userId) {
      console.log('[ERROR] updateUserBadges - No userId found in request');
      return next(new ErrorHandler("User ID not found in request", 401));
    }
    
    // Tìm profile gamification cho người dùng
    let userGamification = await UserGamification.findOne({ user: userId });
    console.log('[DEBUG] userGamification found:', userGamification ? 'Yes' : 'No');
    
    if (!userGamification) {
      console.log('[DEBUG] User does not have gamification profile');
      return next(new ErrorHandler("Gamification profile not found", 404));
    }
    
    // Lấy tổng điểm hiện tại
    const totalPoints = userGamification.points.totalPoints;
    console.log('[DEBUG] User current total points:', totalPoints);
    
    // Cấp huy hiệu dựa trên điểm hiện tại
    const newBadges = await checkAndAwardBadges(userId, totalPoints);
    
    // Lấy thông tin gamification đã được cập nhật
    const updatedUserGamification = await UserGamification.findOne({ user: userId })
      .populate({
        path: 'badges.badgeId',
        model: 'Badge'
      });
    
    return res.status(200).json({
      success: true,
      message: "Badges updated successfully",
      newBadgesCount: newBadges ? newBadges.length : 0,
      gamification: updatedUserGamification
    });
  } catch (error: any) {
    console.error('[ERROR] updateUserBadges error:', error.message);
    return next(new ErrorHandler(error.message, 500));
  }
});