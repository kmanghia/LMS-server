import express from "express";
import axios from "axios";
import { isAutheticated } from "../middleware/auth";

const recommenderRouter = express.Router();


const RECOMMENDER_API_URL = process.env.RECOMMENDER_API_URL || "http://localhost:8000";


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


recommenderRouter.get("/similar/:courseId",isAutheticated, async (req, res) => {
  try {
    const { courseId } = req.params;
    const limit = req.query.limit || 5;
    
    const response = await axios.get(`${RECOMMENDER_API_URL}/recommend/similar/${courseId}?limit=${limit}`);
    
    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error fetching similar courses:", error);
    res.status(500).json({ success: false, message: "Failed to fetch similar courses" });
  }
});


recommenderRouter.get("/popular",isAutheticated, async (req, res) => {
  try {
    const limit = req.query.limit || 5;
    
    const response = await axios.get(`${RECOMMENDER_API_URL}/recommend/popular?limit=${limit}`);
    
    res.status(200).json(response.data);
  } catch (error) {
    console.error("Error fetching popular courses:", error);
    res.status(500).json({ success: false, message: "Failed to fetch popular courses" });
  }
});

export default recommenderRouter;