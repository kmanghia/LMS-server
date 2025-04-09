import { Request, Response, NextFunction } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import LayoutModel from "../models/layout.model";



export const createLayout = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.body;
      const isTypeExist = await LayoutModel.findOne({ type });
      if (isTypeExist) {
        return next(new ErrorHandler(`${type} already exist`, 400));
      }
      if (type === "FAQ") {
        const { faq } = req.body;
        //dùng promise all chạy 3 tác vụ song song trả về kết qua khi tất cả chúng hoàn thành
        const faqItems = await Promise.all(
          faq.map(async (item: any) => {
            return {
              question: item.question,
              answer: item.answer,
            };
          })
        );
        await LayoutModel.create({ type: "FAQ", faq: faqItems });
      }
      if (type === "Categories") {
        const { categories } = req.body;
        const categoriesItems = await Promise.all(
          categories.map(async (item: any) => {
            return {
              title: item.title,
            };
          })
        );
        await LayoutModel.create({
          type: "Categories",
          categories: categoriesItems,
        });
      }

      res.status(200).json({
        success: true,
        message: "Layout đã được tạo thành công",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);


export const editLayout = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { type } = req.body;

        if (type === "FAQ") {
          const { faq } = req.body;
          const FaqItem = await LayoutModel.findOne({ type: "FAQ" });
          const faqItems = await Promise.all(
            faq.map(async (item: any) => {
              return {
                question: item.question,
                answer: item.answer,
              };
            })
          );
          await LayoutModel.findByIdAndUpdate(FaqItem?._id, {
            type: "FAQ",
            faq: faqItems,
          });
        }
        if (type === "Categories") {
          const { categories } = req.body;
          const categoriesData = await LayoutModel.findOne({
            type: "Categories",
          });
          const categoriesItems = await Promise.all(
            categories.map(async (item: any) => {
              return {
                title: item.title,
              };
            })
          );
          await LayoutModel.findByIdAndUpdate(categoriesData?._id, {
            type: "Categories",
            categories: categoriesItems,
          });
        }
  
        res.status(200).json({
          success: true,
          message: "Layout đã cập nhật thành công",
        });
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
      }
    }
);

export const getLayoutByType = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { type } = req.params;
        const layout = await LayoutModel.findOne({ type });
        res.status(201).json({
          success: true,
          layout,
        });
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
      }
    }
  );
  