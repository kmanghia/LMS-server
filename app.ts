require("dotenv").config();
import express, { NextFunction, Request, Response } from "express";
export const app = express();
import cors from "cors";
import cookieParser from "cookie-parser";
import { ErrorMiddleware } from "./middleware/error";
import userRouter from "./routes/user.route";
import courseRouter from "./routes/course.route";
import orderRouter from "./routes/order.route";
import notificationRouter from "./routes/notification.route";
import analyticsRouter from "./routes/analytics.route";
import layoutRouter from "./routes/layout.route";
import mentorRouter from "./routes/mentor.route";
import { rateLimit } from "express-rate-limit";
import cartRouter from "./routes/cart.route";
import quizzRouter from "./routes/quizz.route";
import path from "path";
import ejs from "ejs";
import {
  sendMail
} from "./utils/sendMail";
import ErrorHandler from "./utils/ErrorHandler";
import puppeteer, { Browser } from "puppeteer";
import wishListRouter from "./routes/wishlist.route";
import fs from "fs"
import crypto from 'crypto';
import { isAutheticated } from "./middleware/auth";
import { accessTokenOptions, refreshTokenOptions } from "./utils/jwt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

// body parser
app.use(express.json({ limit: "100mb" }));
app.use(express.static('uploads'));
// cookie parser
app.use(cookieParser());
const corsOptions = {
  origin: 'http://localhost:3000',
  credentials: true,
};
// cors => cross origin resource sharing
app.use(cors(corsOptions));

// api requests limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

// routes
app.use(
  "/api/v1",
  userRouter,
  orderRouter,
  courseRouter,
  notificationRouter,
  analyticsRouter,
  layoutRouter,
  cartRouter,
  quizzRouter,
  wishListRouter,
  mentorRouter
);

const fileTokens = new Map<string, { path: string, expiry: number }>();

// Hàm tạo token tạm thời
function generateTemporaryToken(filePath: string) {
  const token = crypto.randomBytes(32).toString('hex');
  // Token chỉ có hiệu lực trong 1 giờ
  const expiry = Date.now() + 3600000; // 1 hour
  fileTokens.set(token, { path: filePath, expiry });
  return token;
}

// Định kỳ xóa các token hết hạn
setInterval(() => {
  for (const [token, data] of fileTokens.entries()) {
    if (data.expiry < Date.now()) {
      fileTokens.delete(token);
    }
  }
}, 3600000); // Chạy mỗi giờ

// API để lấy URL tạm thời cho file
app.get("/api/files/:fileId", isAutheticated, async (req: Request, res: Response) => {
  try {
    const filePath = path.join(__dirname, 'uploads/videos', req.params.fileId);
    // Kiểm tra file có tồn tại không
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Tạo token tạm thời
    const token = generateTemporaryToken(filePath);


    // Trả về URL tạm thời
    const temporaryUrl = `/view-file/${token}`;
    res.json({ url: temporaryUrl });

  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route để xem/tải file bằng token
app.get("/view-file/:token", isAutheticated, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fileData = fileTokens.get(req.params.token);

    if (!fileData) {
      return res.status(404).send('Invalid or expired token');
    }

    if (fileData.expiry < Date.now()) {
      fileTokens.delete(req.params.token);
      return res.status(404).send('File link expired');
    }

    const ext = path.extname(fileData.path).toLowerCase();
    const contentTypeMap: any = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.mp4': 'video/mp4',  // Thêm phần hỗ trợ video MP4
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    // Đặt headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');

    if (ext === '.mp4') {
      const stat = fs.statSync(fileData.path);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;

        const fileStream = fs.createReadStream(fileData.path, { start, end });
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', chunksize);
        res.status(206);
        fileStream.pipe(res);
      } else {
        const fileStream = fs.createReadStream(fileData.path);
        res.setHeader('Content-Length', fileSize);
        fileStream.pipe(res);
      }
    } else {
      const fileStream = fs.createReadStream(fileData.path);
      fileStream.pipe(res);
    }


  } catch (error) {
    res.status(500).send('Error streaming file');
  }
});


// Front-end example
app.get("/display-video-example", (req: Request, res: Response) => {
  res.send(`
      <html>
          <body>
              <h2>Ví dụ hiển thị video an toàn</h2>
              <video id="secureVideo" width="640" controls>
                  <source id="videoSource" type="video/mp4">
              </video>
              <script>
                  // Gọi API để lấy URL tạm thời cho video
                  fetch('/api/files/20257855-hd_1920_1080_60fps.mp4')
                      .then(response => response.json())
                      .then(data => {
                          // Đặt URL video vào phần tử video source
                          document.getElementById('videoSource').src = data.url;
                          document.getElementById('secureVideo').load(); // Đảm bảo video tải
                      });
              </script>
          </body>
      </html>
  `);
});


// app.set('view engine', 'ejs');
// app.set('views', './mails');
// testing api
app.get("/test", async (req: Request, res: Response, next: NextFunction) => {
  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch({ headless: true }); // Đặt headless là true nếu không cần thấy trình duyệt
    const [page] = await browser.pages();
    const html = await ejs.renderFile("./mails/send-certification.ejs", {
      course: 'ava',
      name: 'adsasd',
      date: new Date().toLocaleDateString('en-us')
    });
    await page.setContent(html);

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "20px",
        right: "20px",
        bottom: "20px",
        left: "20px"
      }
    });

    console.log("PDF generated successfully:", pdf.length > 0); // Kiểm tra kích thước PDF
    res.contentType("application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=send-certification.pdf");
    res.end(pdf);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});


// đường dẫn ko tồn tại
app.all("*", (req: Request, res: Response, next: NextFunction) => {
  const err = new Error(`Đường dẫn ${req.originalUrl} không tìm thấy`) as any;
  err.statusCode = 404;
  next(err);
});

//gọi middleware 
app.use(limiter);
app.use(ErrorMiddleware);

// require("dotenv").config();
// import express, { NextFunction, Request, Response } from "express";
// export const app = express();
// import cors from "cors";
// import cookieParser from "cookie-parser";
// import { rateLimit } from "express-rate-limit";
// import { ErrorMiddleware } from "./middleware/error";
// import userRouter from "./routes/user.route";
// import courseRouter from "./routes/course.route";
// import orderRouter from "./routes/order.route";
// import notificationRouter from "./routes/notification.route";
// import analyticsRouter from "./routes/analytics.route";
// import layoutRouter from "./routes/layout.route";
// //body parser
// //kích thước tối đa dữ liệu mà server có thể nhận được
// app.use(express.json({limit: "50mb"}))

// //cookie parser
// app.use(cookieParser());

// //cors
// // app.use(cors(
// //    {
// //     origin: process.env.ORIGIN
// //    }
// // ));
// app.use(cors());

// // giới hạn só lượng request
// const limiter = rateLimit({
//     windowMs: 15 * 60 * 1000,
//     max: 100,
//     standardHeaders: "draft-7",
//     legacyHeaders: false,
//   });

// //routes
// app.use(
//   "/api/v1",
//   userRouter,
//   orderRouter,
//   courseRouter,
//   notificationRouter,
//   analyticsRouter,
//   layoutRouter
// );
// //kiểm tra api
// app.get("/test", (req: Request, res: Response, next: NextFunction) => {
//     res.status(200).json({
//       succcess: true,
//       message: "API đang làm việc",
//     });
//   });

// // đường dẫn không tìm thấy
// app.all("*", (req: Request, res: Response, next: NextFunction) => {
//     const err = new Error(`Đường dẫn ${req.originalUrl} không tìm thấy`) as any;
//     err.statusCode = 404;
//     next(err);
//   });

// // middleware calls
// app.use(limiter);
// app.use(ErrorMiddleware);