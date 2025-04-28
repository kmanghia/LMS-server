import express from "express";
import {
    saveResultQuizzOfUser,
    fetchAllQuizzOfUser
} from "../controllers/quizz.controller";
import {
    isAutheticated
} from "../middleware/auth"
const quizzRouter = express.Router();

quizzRouter.post("/save-quizz", saveResultQuizzOfUser);
quizzRouter.get("/quizzs/:userId", isAutheticated, fetchAllQuizzOfUser);
quizzRouter.delete('/quizzs/:id');
export default quizzRouter;
