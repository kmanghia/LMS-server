import { Request, Response } from 'express';
import { Types } from 'mongoose';
import mongoose from 'mongoose';
import CourseModel from '../models/course.model';
import recommendationService from '../services/recommendation.service';

/**
 * Controller xử lý các yêu cầu liên quan đến hệ thống gợi ý
 */
class RecommendationController {
  /**
   * Lấy gợi ý khóa học dựa trên nội dung cho người dùng
   */
  async getContentBasedRecommendations(req: Request, res: Response) {
    try {
      const userId = req.user?._id.toString();
      const limit = parseInt(req.query.limit as string) || 5;
      
      // Kiểm tra ID hợp lệ
      if (!Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'ID người dùng không hợp lệ' });
      }
      
      console.log(`Đang lấy gợi ý content-based cho user ${userId} với limit=${limit}`);
      const recommendations = await recommendationService.getContentBasedRecommendations(userId, limit);
      
      // Lấy thông tin đầy đủ từ database
      if (recommendations && recommendations.recommendations && recommendations.recommendations.length > 0) {
        // Tạo query để tìm khóa học theo tên thay vì ID
        const courseNames = recommendations.recommendations.map((course: any) => course.name).filter((name: any) => name);
        
        if (courseNames.length > 0) {
          // Tạo mảng các điều kiện tìm kiếm theo tên
          const nameQueries = courseNames.map((name: any) => ({
            name: { $regex: name, $options: 'i' } // tìm kiếm không phân biệt hoa thường
          }));
          
          // Lấy thông tin đầy đủ của khóa học từ database
          const fullCourseData = await CourseModel.find({
            $or: nameQueries,
            status: "active"
          }).select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links");
          
          // Tạo map để dễ dàng tìm kiếm điểm dự đoán theo tên
          const scoreMap: Record<string, number> = {};
          recommendations.recommendations.forEach((course: any) => {
            if (course.name) {
              scoreMap[course.name] = course.score;
            }
          });
          
          // Gán score vào kết quả
          const enhancedCourses = fullCourseData.map(course => {
            const courseObj: any = course.toObject();
            courseObj.score = scoreMap[course.name] || 0;
            return courseObj;
          });
          
          // Trả về kết quả với thông tin đầy đủ
          return res.status(200).json({
            user_id: recommendations.user_id,
            recommendedCourses: enhancedCourses,
            total: enhancedCourses.length
          });
        }
      }
      
      // Nếu không tìm thấy khóa học hoặc không có ID, trả về kết quả gốc
      return res.status(200).json(recommendations);
    } catch (error) {
      console.error('Error in getContentBasedRecommendations:', error);
      return res.status(500).json({ 
        message: 'Lỗi khi lấy gợi ý content-based',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Lấy gợi ý khóa học dựa trên Item-Based Collaborative Filtering
   */
  async getItemBasedRecommendations(req: Request, res: Response) {
    try {
      const userId = req.user?._id.toString();
      const limit = parseInt(req.query.limit as string) || 5;
      
      // Kiểm tra ID hợp lệ
      if (!Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'ID người dùng không hợp lệ' });
      }
      
      console.log(`Đang lấy gợi ý item-based cho user ${userId} với limit=${limit}`);
      const recommendations = await recommendationService.getItemBasedRecommendations(userId, limit);
      
      // Lấy thông tin đầy đủ từ database
      if (recommendations && recommendations.recommendations && recommendations.recommendations.length > 0) {
        // Tạo query để tìm khóa học theo tên thay vì ID
        const courseNames = recommendations.recommendations.map((course: any) => course.name).filter((name: string) => name);
        
        if (courseNames.length > 0) {
          // Tạo mảng các điều kiện tìm kiếm theo tên
          const nameQueries = courseNames.map((name: string) => ({
            name: { $regex: name, $options: 'i' } // tìm kiếm không phân biệt hoa thường
          }));
          
          // Lấy thông tin đầy đủ của khóa học từ database
          const fullCourseData = await CourseModel.find({
            $or: nameQueries,
            status: "active"
          }).select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links");
          
          // Tạo map để dễ dàng tìm kiếm điểm dự đoán theo tên
          const scoreMap: Record<string, number> = {};
          recommendations.recommendations.forEach((course: any) => {
            if (course.name) {
              scoreMap[course.name] = course.score;
            }
          });
          
          // Gán score vào kết quả
          const enhancedCourses = fullCourseData.map(course => {
            const courseObj: any = course.toObject();
            courseObj.score = scoreMap[course.name] || 0;
            return courseObj;
          });
          
          // Trả về kết quả với thông tin đầy đủ
          return res.status(200).json({
            user_id: recommendations.user_id,
            recommendedCourses: enhancedCourses,
            total: enhancedCourses.length
          });
        }
      }
      
      // Nếu không tìm thấy khóa học hoặc không có ID, trả về kết quả gốc
      return res.status(200).json(recommendations);
    } catch (error) {
      console.error('Error in getItemBasedRecommendations:', error);
      return res.status(500).json({ 
        message: 'Lỗi khi lấy gợi ý item-based',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Lấy gợi ý khóa học dựa trên User-Based Collaborative Filtering
   */
  async getUserBasedRecommendations(req: Request, res: Response) {
    try {
      const userId = req.user?._id.toString();
      const limit = parseInt(req.query.limit as string) || 5;
      
      // Kiểm tra ID hợp lệ
      if (!Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'ID người dùng không hợp lệ' });
      }
      
      console.log(`Đang lấy gợi ý user-based cho user ${userId} với limit=${limit}`);
      const recommendations = await recommendationService.getUserBasedRecommendations(userId, limit);
      
      // Lấy thông tin đầy đủ từ database
      if (recommendations && recommendations.recommendations && recommendations.recommendations.length > 0) {
        // Tạo query để tìm khóa học theo tên thay vì ID
        const courseNames = recommendations.recommendations.map((course: any) => course.name).filter((name: string) => name);
        
        if (courseNames.length > 0) {
          // Tạo mảng các điều kiện tìm kiếm theo tên
          const nameQueries = courseNames.map((name: string) => ({
            name: { $regex: name, $options: 'i' } // tìm kiếm không phân biệt hoa thường
          }));
          
          // Lấy thông tin đầy đủ của khóa học từ database
          const fullCourseData = await CourseModel.find({
            $or: nameQueries,
            status: "active"
          }).select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links");
          
          // Tạo map để dễ dàng tìm kiếm điểm dự đoán theo tên
          const scoreMap: Record<string, number> = {};
          recommendations.recommendations.forEach((course: any) => {
            if (course.name) {
              scoreMap[course.name] = course.score;
            }
          });
          
          // Gán score vào kết quả
          const enhancedCourses = fullCourseData.map(course => {
            const courseObj: any = course.toObject();
            courseObj.score = scoreMap[course.name] || 0;
            return courseObj;
          });
          
          // Trả về kết quả với thông tin đầy đủ
          return res.status(200).json({
            user_id: recommendations.user_id,
            recommendedCourses: enhancedCourses,
            total: enhancedCourses.length
          });
        }
      }
      
      // Nếu không tìm thấy khóa học hoặc không có ID, trả về kết quả gốc
      return res.status(200).json(recommendations);
    } catch (error) {
      console.error('Error in getUserBasedRecommendations:', error);
      return res.status(500).json({ 
        message: 'Lỗi khi lấy gợi ý user-based',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Tìm các khóa học tương tự với một khóa học cụ thể
   */
  async getSimilarCourses(req: Request, res: Response) {
    try {
      const courseId = req.params.courseId;
      const limit = parseInt(req.query.limit as string) || 5;
      
      // Kiểm tra ID hợp lệ
      if (!Types.ObjectId.isValid(courseId)) {
        return res.status(400).json({ message: 'ID khóa học không hợp lệ' });
      }
      
      console.log(`Đang tìm khóa học tương tự với ${courseId}, limit=${limit}`);
      const similarCourses = await recommendationService.getSimilarCourses(courseId, limit);
      
      // Lấy thông tin đầy đủ từ database
      if (similarCourses && similarCourses.similar_courses && similarCourses.similar_courses.length > 0) {
        // Tạo query để tìm khóa học theo tên thay vì ID
        const courseNames = similarCourses.similar_courses.map((course: any) => course.name).filter((name: string) => name);
        
        if (courseNames.length > 0) {
          // Tạo mảng các điều kiện tìm kiếm theo tên
          const nameQueries = courseNames.map((name: string) => ({
            name: { $regex: name, $options: 'i' } // tìm kiếm không phân biệt hoa thường
          }));
          
          // Lấy thông tin đầy đủ của khóa học từ database
          const fullCourseData = await CourseModel.find({
            $or: nameQueries,
            status: "active"
          }).select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links");
          
          // Tạo map để dễ dàng tìm kiếm điểm tương tự theo tên
          const scoreMap: Record<string, number> = {};
          similarCourses.similar_courses.forEach((course: any) => {
            if (course.name) {
              scoreMap[course.name] = course.score;
            }
          });
          
          // Gán score vào kết quả
          const enhancedCourses = fullCourseData.map(course => {
            const courseObj: any = course.toObject();
            courseObj.score = scoreMap[course.name] || 0;
            return courseObj;
          });
          
          // Trả về kết quả với thông tin đầy đủ
          return res.status(200).json({
            course_id: similarCourses.course_id,
            course_name: similarCourses.course_name,
            similar_courses: enhancedCourses,
            total: enhancedCourses.length
          });
        }
      }
      
      // Nếu không tìm thấy khóa học hoặc không có ID, trả về kết quả gốc
      return res.status(200).json(similarCourses);
    } catch (error) {
      console.error('Error in getSimilarCourses:', error);
      return res.status(500).json({ 
        message: 'Lỗi khi lấy khóa học tương tự',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Lấy danh sách khóa học phổ biến
   */
  async getPopularCourses(req: Request, res: Response) {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const m = parseInt(req.query.m as string) || 10;
      
      console.log(`Đang lấy khóa học phổ biến với limit=${limit}, m=${m}`);
      const popularCourses = await recommendationService.getPopularCourses(limit, m);
      
      // Lấy thông tin đầy đủ từ database
      if (popularCourses && popularCourses.popular_courses && popularCourses.popular_courses.length > 0) {
        // Tạo query để tìm khóa học theo tên thay vì ID
        const courseNames = popularCourses.popular_courses.map((course: any) => course.name).filter((name: string) => name);
        
        if (courseNames.length > 0) {
          // Tạo mảng các điều kiện tìm kiếm theo tên
          const nameQueries = courseNames.map((name: string) => ({
            name: { $regex: name, $options: 'i' } // tìm kiếm không phân biệt hoa thường
          }));
          
          // Lấy thông tin đầy đủ của khóa học từ database
          const fullCourseData = await CourseModel.find({
            $or: nameQueries,
            status: "active"
          }).select("-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links");
          
          // Tạo map để dễ dàng tìm kiếm weighted score theo tên
          const scoreMap: Record<string, number> = {};
          popularCourses.popular_courses.forEach((course: any) => {
            if (course.name) {
              scoreMap[course.name] = course.score;
            }
          });
          
          // Gán score vào kết quả
          const enhancedCourses = fullCourseData.map(course => {
            const courseObj: any = course.toObject();
            courseObj.score = scoreMap[course.name] || 0;
            return courseObj;
          });
          
          // Trả về kết quả với thông tin đầy đủ
          return res.status(200).json({
            popular_courses: enhancedCourses,
            total: enhancedCourses.length,
            weighted_parameter: popularCourses.weighted_parameter
          });
        }
      }
      
      // Nếu không tìm thấy khóa học hoặc không có ID, trả về kết quả gốc
      return res.status(200).json(popularCourses);
    } catch (error) {
      console.error('Error in getPopularCourses:', error);
      return res.status(500).json({ 
        message: 'Lỗi khi lấy khóa học phổ biến',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Lấy tất cả các gợi ý cho người dùng
   */
  async getAllRecommendations(req: Request, res: Response) {
    try {
      const userId = req.params.userId;
      const limit = parseInt(req.query.limit as string) || 5;
      
      // Kiểm tra ID hợp lệ
      if (!Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'ID người dùng không hợp lệ' });
      }
      
      console.log(`Đang lấy tất cả gợi ý cho user ${userId} với limit=${limit}`);
      const allRecommendations = await recommendationService.getAllRecommendations(userId, limit);
      return res.status(200).json(allRecommendations);
    } catch (error) {
      console.error('Error in getAllRecommendations:', error);
      return res.status(500).json({ 
        message: 'Lỗi khi lấy tất cả gợi ý',
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
  
  /**
   * API kiểm tra kết nối đến hệ thống gợi ý
   */
  async testConnection(req: Request, res: Response) {
    try {
      // Thử gọi API lấy khóa học phổ biến với limit nhỏ
      console.log('Đang kiểm tra kết nối đến hệ thống gợi ý...');
      const result = await recommendationService.getPopularCourses(1, 10);
      
      return res.status(200).json({
        message: 'Kết nối thành công đến hệ thống gợi ý',
        api_url: process.env.RECOMMENDATION_API_URL || 'http://127.0.0.1:5000',
        test_result: result
      });
    } catch (error) {
      console.error('Error testing recommendation system connection:', error);
      return res.status(500).json({
        message: 'Lỗi kết nối đến hệ thống gợi ý',
        error: error instanceof Error ? error.message : 'Unknown error',
        api_url: process.env.RECOMMENDATION_API_URL || 'http://127.0.0.1:5000'
      });
    }
  }
}

export default new RecommendationController(); 