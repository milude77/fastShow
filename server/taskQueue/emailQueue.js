import { Queue } from 'bullmq';
import { connection } from './connection.js';

export const emailQueue = new Queue('emailQueue', {
    connection,
    defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: true,
        removeOnFail: false
    }
});