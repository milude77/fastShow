// services/emailService.js
import { emailQueue } from './emailQueue.js';

export async function enqueueEmailCode(email, code) {
  await emailQueue.add(
    'sendCode',
    { email, code },
    {
      jobId: `email_${email}`, // 防重复
    }
  );
}