import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import { Badge, UserGamification } from "../models/gamification.model";
import UserModel from "../models/user.model";
import mongoose from "mongoose";

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
          weeklyPoints: 0,
          monthlyPoints: 0,
          lastResetWeekly: new Date(),
          lastResetMonthly: new Date(),
          history: []
        },
        badges: [],
        level: 1,
        rank: 0
      });
      console.log('[DEBUG] New userGamification created:', userGamification._id);
    }
    
    // Kiểm tra và khởi tạo points nếu chưa có
    if (!userGamification.points) {
      console.log('[DEBUG] Initializing points object');
      const pointsData = {
        totalPoints: 0,
        weeklyPoints: 0,
        monthlyPoints: 0,
        lastResetWeekly: new Date(),
        lastResetMonthly: new Date(),
        history: []
      };
      userGamification.set('points', pointsData);
    }
    
    // Cập nhật điểm
    userGamification.points.totalPoints += points;
    // userGamification.points.weeklyPoints += points;
    // userGamification.points.monthlyPoints += points;
    // console.log('[DEBUG] Updated points:', {
    //   totalPoints: userGamification.points.totalPoints,
    //   weeklyPoints: userGamification.points.weeklyPoints,
    //   monthlyPoints: userGamification.points.monthlyPoints
    // });
    
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
    console.log('[DEBUG] getUserGamification - headers:', JSON.stringify(req.headers));
    
    if (!userId) {
      console.log('[ERROR] getUserGamification - No userId found in request');
      return next(new ErrorHandler("User ID not found in request", 401));
    }
    
    console.log(`[DEBUG] Searching for gamification data with user ID: ${userId}`);
    
    let userGamification = await UserGamification.findOne({ user: userId })
      .populate({
        path: 'badges.badgeId',
        model: 'Badge'
      });
    
    console.log('[DEBUG] userGamification found:', userGamification ? 'Yes' : 'No');
    if (userGamification) {
      console.log('[DEBUG] userGamification data structure:', JSON.stringify({
        hasPoints: !!userGamification.points,
        level: userGamification.level,
        badges: (userGamification.badges || []).length
      }));
    }
    
    if (!userGamification) {
      console.log('[DEBUG] Creating new userGamification record');
      userGamification = await UserGamification.create({
        user: userId,
        badges: [],
        points: {
          totalPoints: 0,
          weeklyPoints: 0,
          monthlyPoints: 0,
          lastResetWeekly: new Date(),
          lastResetMonthly: new Date(),
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
        });
    }
    
    console.log('[DEBUG] getUserGamification - Response status: 200');
    console.log('[DEBUG] getUserGamification - Response data structure:', JSON.stringify({
      success: true,
      hasGamification: userGamification ? 'Yes' : 'No',
      dataKeys: userGamification ? Object.keys(userGamification.toObject()) : []
    }));
    
    return res.status(200).json({
      success: true,
      gamification: userGamification
    });
  } catch (error: any) {
    console.error('[ERROR] getUserGamification error:', error.message, error.stack);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Lấy bảng xếp hạng
export const getLeaderboard = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type = 'weekly', limit = 10 } = req.query;
    let sortField = 'points.weeklyPoints';
    
    if (type === 'monthly') {
      sortField = 'points.monthlyPoints';
    } else if (type === 'all-time') {
      sortField = 'points.totalPoints';
    }
    
    const leaderboard = await UserGamification.find()
      .populate('user', 'name avatar')
      .sort({ [sortField]: -1 })
      .limit(Number(limit))
      .select('user level points');
    
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

// Cấp huy hiệu cho người dùng (chỉ admin)
export const awardBadgeToUser = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, badgeId } = req.body;
    
    if (!userId || !badgeId) {
      return next(new ErrorHandler("User ID and badge ID are required", 400));
    }
    
    const result = await awardBadgeToUserInternal(userId, badgeId);
    
    return res.status(200).json({
      success: true,
      message: `Badge awarded to user ${userId}`,
      result
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

// Hàm nội bộ để cấp huy hiệu cho người dùng
const awardBadgeToUserInternal = async (userId: string, badgeId: any) => {
  try {
    const badge = await Badge.findById(badgeId);
    if (!badge) {
      throw new Error(`Badge not found with ID: ${badgeId}`);
    }
    
    const userGamification = await UserGamification.findOne({ user: userId });
    if (!userGamification) {
      throw new Error(`User gamification profile not found for user: ${userId}`);
    }
    
    // Kiểm tra xem người dùng đã có huy hiệu này chưa
    const hasBadge = userGamification.badges.some(
      (b) => b.badgeId.toString() === badgeId.toString()
    );
    
    if (hasBadge) {
      throw new Error(`User ${userId} already has badge ${badgeId}`);
    }
    
    // Thêm huy hiệu mới
    userGamification.badges.push({
      badgeId,
      dateEarned: new Date(),
    });
    
    await userGamification.save();
    return { badge, userGamification };
  } catch (error) {
    console.error('Error awarding badge:', error);
    throw error;
  }
};