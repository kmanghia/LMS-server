import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsCommand,ListObjectsV2Command,ObjectCannedACL  } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv'

dotenv.config()

const bucketName = process.env.AWS_BUCKET_NAME as any;
const region = process.env.AWS_BUCKET_REGION as any;
const accessKeyId = process.env.AWS_ACCESS_KEY as any;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY as any;

const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey
  }
})


export function uploadFile(fileBuffer: any, fileName: any, mimetype: any) {
  const uploadParams = {
    Bucket: bucketName,
    Body: fileBuffer,
    Key: fileName,
    ContentType: mimetype
  }

  return s3Client.send(new PutObjectCommand(uploadParams));
}

export function deleteFile(fileName: any) {
  const deleteParams = {
    Bucket: bucketName,
    Key: fileName,
  }

  return s3Client.send(new DeleteObjectCommand(deleteParams));
}

export function getList(){
  const listParams = {
    Bucket: bucketName
  }

  return s3Client.send(new ListObjectsV2Command(listParams))
}

export async function getObjectSignedUrl(key: any) {
  const params = {
    Bucket: bucketName,
    Key: key
  }

  
  const command = new GetObjectCommand(params);
  const seconds = 60
  const url = await getSignedUrl(s3Client, command, { expiresIn: seconds });
  console.log(url)
  return url
}

export const uploadBase64ToS3 = async (base64Image: any) => {
  // Tách phần header của base64
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

  // Chuyển base64 thành Buffer
  const buffer = Buffer.from(base64Data, 'base64');

  // Định dạng file, ví dụ image/png hoặc image/jpeg
  const fileType = base64Image.split(';')[0].split('/')[1];

  // Tạo tên file ngẫu nhiên
  const fileName = `courses/${uuidv4()}.${fileType}`;

  // Cấu hình các thông tin cần để upload lên S3
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME, // Tên bucket
    Key: fileName, // Đường dẫn và tên file trên S3
    Body: buffer, // Dữ liệu của file
    ContentType: `image/${fileType}`, // Định dạng của file
    
  };

  // Upload lên S3
  try {
    const command = new PutObjectCommand(params);
    const data = await s3Client.send(command);
    return {
      url: `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/${fileName}`, // URL của ảnh sau khi upload
      key: fileName, // Khóa (key) dùng để quản lý file trong S3
    };
  } catch (err) {
    console.error("Error uploading image to S3: ", err);
    throw err;
  }
};