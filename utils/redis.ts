import {Redis} from 'ioredis';
require('dotenv').config();

const redisClient = () => {
    if(process.env.REDIS_URL){
        console.log(`Redis đã được kết nối`);
        return process.env.REDIS_URL;
    }
    throw new Error('Redis kết nối thất bại');
};

export const redis = new Redis(redisClient());

// import { Redis } from 'ioredis';
// require('dotenv').config();

// const redisClient = () => {
//     if (process.env.REDIS_URL) {
//         const client = new Redis(process.env.REDIS_URL);

//         client.on('connect', () => {
//             console.log('Redis đã được kết nối');
//         });

//         client.on('error', (err) => {
//             console.error('Redis lỗi kết nối:', err);
//         });

//         return client;
//     }
//     throw new Error('Redis kết nối thất bại: REDIS_URL không tồn tại');
// };

// export const redis = redisClient();
