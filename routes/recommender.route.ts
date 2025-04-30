import express from "express";
import axios from "axios";
import { isAutheticated } from "../middleware/auth";
import CourseModel from "../models/course.model";
import mongoose from "mongoose";

const recommenderRouter = express.Router();


const RECOMMENDER_API_URL = process.env.RECOMMENDER_API_URL || "http://localhost:8000";

// Interface cho API response
interface RecommendationItem {
  _id?: string;
  name?: string;
  description?: string;
  categories?: string;
  tags?: string;
  level?: string;
  ratings?: number;
  purchased?: number;
}

interface RecommendationResponse {
  recommendations?: RecommendationItem[];
  [key: string]: any;
}


recommenderRouter.get("/recommendations", isAutheticated, async (req, res) => {
  try {
    const userId = req.user?._id.toString();
    const limit = req.query.limit || 5;
    
    const response = await axios.get(`${RECOMMENDER_API_URL}/recommend/user/${userId}?limit=${limit}`);
    
    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    res.status(500).json({ success: false, message: "Failed to fetch recommendations" });
  }
});


recommenderRouter.get("/similar/:courseId", isAutheticated, async (req, res) => {
  try {
    const { courseId } = req.params;
    const limit = req.query.limit || 5;
    
    console.log(`[DEBUG] Fetching similar courses for courseId: ${courseId}, limit: ${limit}`);
    
    // Lấy đề xuất từ AI recommendation system
    const response = await axios.get(`${RECOMMENDER_API_URL}/recommend/similar/${courseId}?limit=${limit}`);
    
    console.log(`[DEBUG] Raw AI recommendations:`, response.data);
    
    // Trích xuất ids hoặc tên khóa học từ kết quả AI
    let recommendedCoursesData = [];
    
    if (response.data && response.data.recommendations) {
      const data: RecommendationResponse = response.data;
      
      // Lấy IDs từ recommendation API
      const recommendedIds = (data.recommendations || [])
        .filter((course: RecommendationItem) => course._id)
        .map((course: RecommendationItem) => course._id as string);
      
      // Lấy tên khóa học để tìm kiếm backup nếu không có ID
      const recommendedNames = (data.recommendations || [])
        .filter((course: RecommendationItem) => course.name)
        .map((course: RecommendationItem) => course.name as string);
      
      console.log(`[DEBUG] Extracted IDs:`, recommendedIds);
      console.log(`[DEBUG] Extracted Names:`, recommendedNames);
      
      // Lấy khóa học đầy đủ từ database
      if (recommendedIds.length > 0) {
        try {
          // Chuyển đổi strings thành ObjectIds nếu cần
          const objectIds = recommendedIds.map((id: string) => {
            try {
              return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
            } catch (e) {
              return id;
            }
          });
          
          // Tìm khóa học theo IDs
          recommendedCoursesData = await CourseModel.find({ 
            _id: { $in: objectIds },
            status: "active"
          }).select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links");
          
          console.log(`[DEBUG] Found ${recommendedCoursesData.length} courses by IDs`);
        } catch (idError) {
          console.error("[DEBUG] Error finding courses by IDs:", idError);
        }
      }
      
      // Nếu không tìm thấy đủ khóa học theo ID, tìm theo tên
      if (recommendedCoursesData.length < recommendedNames.length) {
        try {
          const nameQueries = recommendedNames.map((name: string) => ({
            name: { $regex: name, $options: "i" }
          }));
          
          if (nameQueries.length > 0) {
            const coursesByName = await CourseModel.find({ 
              $or: nameQueries,
              status: "active"
            }).select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links");
            
            // Lọc ra các khóa học không trùng với kết quả trước
            const existingIds = recommendedCoursesData.map(c => c._id.toString());
            const newCourses = coursesByName.filter(c => !existingIds.includes(c._id.toString()));
            
            recommendedCoursesData = [...recommendedCoursesData, ...newCourses];
            console.log(`[DEBUG] Added ${newCourses.length} courses by name`);
          }
        } catch (nameError) {
          console.error("[DEBUG] Error finding courses by names:", nameError);
        }
      }
    }
    
    // Nếu không tìm được khóa học theo đề xuất, lấy các khóa học phổ biến
    if (recommendedCoursesData.length === 0) {
      console.log(`[DEBUG] Fallback to popular courses`);
      recommendedCoursesData = await CourseModel.find({ status: "active" })
        .sort({ ratings: -1, purchased: -1 })
        .limit(Number(limit))
        .select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links");
    }
    
    // Giới hạn số lượng kết quả
    recommendedCoursesData = recommendedCoursesData.slice(0, Number(limit));
    
    console.log(`[DEBUG] Final result: ${recommendedCoursesData.length} courses`);
    
    res.status(200).json({
      success: true,
      recommendedCourses: recommendedCoursesData
    });
  } catch (error) {
    console.error("Error fetching similar courses:", error);
    console.log(`[DEBUG] Error details:`, error);
    res.status(500).json({ success: false, message: "Failed to fetch similar courses" });
  }
});


recommenderRouter.get("/popular", isAutheticated, async (req, res) => {
  try {
    const limit = req.query.limit || 5;
    
    // Lấy đề xuất từ AI recommendation system
    const response = await axios.get(`${RECOMMENDER_API_URL}/recommend/popular?limit=${limit}`);
    
    // Trích xuất IDs từ kết quả AI
    let recommendedCoursesData = [];
    
    if (response.data && response.data.recommendations) {
      const data: RecommendationResponse = response.data;
      
      // Lấy IDs từ recommendation API
      const recommendedIds = (data.recommendations || [])
        .filter((course: RecommendationItem) => course._id)
        .map((course: RecommendationItem) => course._id as string);
      
      // Lấy khóa học đầy đủ từ database
      if (recommendedIds.length > 0) {
        recommendedCoursesData = await CourseModel.find({ 
          _id: { $in: recommendedIds },
          status: "active"
        }).select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links");
      }
    }
    
    // Nếu không tìm được khóa học theo đề xuất, lấy các khóa học phổ biến
    if (recommendedCoursesData.length === 0) {
      recommendedCoursesData = await CourseModel.find({ status: "active" })
        .sort({ ratings: -1, purchased: -1 })
        .limit(Number(limit))
        .select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links");
    }
    
    // Giới hạn số lượng kết quả
    recommendedCoursesData = recommendedCoursesData.slice(0, Number(limit));
    
    res.status(200).json({
      success: true,
      recommendedCourses: recommendedCoursesData
    });
  } catch (error) {
    console.error("Error fetching popular courses:", error);
    res.status(500).json({ success: false, message: "Failed to fetch popular courses" });
  }
});

export default recommenderRouter;
