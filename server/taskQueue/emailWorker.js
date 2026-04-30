// worker/emailWorker.js
import { Worker } from 'bullmq';
import { connection } from './connection.js';
import { Resend } from 'resend';
import dotenv from 'dotenv';
import logger from '../logger.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.join(__dirname, '../config.env')
});
const resend = new Resend(process.env.RESEND_API_KEY);

const worker = new Worker(
  'emailQueue',
  async (job) => {
    const { email, code } = job.data;

    try {
      const res = await resend.emails.send({
        from: process.env.EMAIL_FROM, // 必须是已验证域名
        to: email,
        subject: 'fastShow verification code',
        text: `感谢您参与 fastShow！您的验证码是 ${code}，5分钟内有效，请勿泄露。`,
      });

      return res; // 返回结果给 BullMQ
    } catch (err) {
      logger.error('Resend 发送失败:', err);
      throw err; 
    }
  },
  {
    connection,
    concurrency: 2,

    // 限速（Resend 比 Gmail 宽松，但仍建议保守）
    limiter: {
      max: 5,
      duration: 1000
    }
  }
);

// 成功日志
worker.on('completed', (job, result) => {
  logger.info(`邮件发送成功 jobId=${job.id}`);
});

// 失败日志（含重试）
worker.on('failed', (job, err) => {
  logger.error(`邮件发送失败 jobId=${job?.id} err=${err.message}`);
});