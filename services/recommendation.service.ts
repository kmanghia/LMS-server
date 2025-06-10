import axios from 'axios';

// Cấu hình URL cho Recommendation API
const RECOMMENDATION_API_URL = process.env.RECOMMENDATION_API_URL || 'http://127.0.0.1:5000/api';

class RecommendationService {
  /**
   * Lấy gợi ý khóa học dựa trên nội dung (Content-Based)
   * @param userId ID của người dùng
   * @param limit Số lượng khóa học gợi ý muốn lấy
   */
  async getContentBasedRecommendations(userId: string, limit: number = 5) {
    try {
      const response = await axios.get(`${RECOMMENDATION_API_URL}/content-based/recommend/${userId}`, {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      console.error(`Error getting content-based recommendations: ${error}`);
      throw error;
    }
  }

  /**
   * Lấy gợi ý khóa học dựa trên Item-Based Collaborative Filtering
   * @param userId ID của người dùng
   * @param limit Số lượng khóa học gợi ý muốn lấy
   */
  async getItemBasedRecommendations(userId: string, limit: number = 5) {
    try {
      const response = await axios.get(`${RECOMMENDATION_API_URL}/item-based/recommend/${userId}`, {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      console.error(`Error getting item-based recommendations: ${error}`);
      throw error;
    }
  }

  /**
   * Lấy gợi ý khóa học dựa trên User-Based Collaborative Filtering
   * @param userId ID của người dùng
   * @param limit Số lượng khóa học gợi ý muốn lấy
   */
  async getUserBasedRecommendations(userId: string, limit: number = 5) {
    try {
      const response = await axios.get(`${RECOMMENDATION_API_URL}/user-based/recommend/${userId}`, {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      console.error(`Error getting user-based recommendations: ${error}`);
      throw error;
    }
  }

  /**
   * Tìm các khóa học tương tự với một khóa học cụ thể
   * @param courseId ID của khóa học
   * @param limit Số lượng khóa học tương tự muốn lấy
   */
  async getSimilarCourses(courseId: string, limit: number = 5) {
    try {
      const response = await axios.get(`${RECOMMENDATION_API_URL}/content-based/similar/${courseId}`, {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      console.error(`Error getting similar courses: ${error}`);
      throw error;
    }
  }

  /**
   * Lấy danh sách khóa học phổ biến dựa trên weighted average
   * @param limit Số lượng khóa học phổ biến muốn lấy
   * @param m Tham số m trong công thức weighted average
   */
  async getPopularCourses(limit: number = 10, m: number = 10) {
    try {
      const response = await axios.get(`${RECOMMENDATION_API_URL}/popular-courses`, {
        params: { limit, m }
      });
      return response.data;
    } catch (error) {
      console.error(`Error getting popular courses: ${error}`);
      throw error;
    }
  }

  /**
   * Lấy tất cả các gợi ý cho một người dùng
   * @param userId ID của người dùng
   * @param limit Số lượng khóa học gợi ý cho mỗi phương pháp
   */
  async getAllRecommendations(userId: string, limit: number = 5) {
    try {
      const [contentBased, itemBased, userBased, popular] = await Promise.all([
        this.getContentBasedRecommendations(userId, limit),
        this.getItemBasedRecommendations(userId, limit),
        this.getUserBasedRecommendations(userId, limit),
        this.getPopularCourses(limit)
      ]);

      return {
        contentBased,
        itemBased,
        userBased,
        popular
      };
    } catch (error) {
      console.error(`Error getting all recommendations: ${error}`);
      throw error;
    }
  }
}

export default new RecommendationService(); 