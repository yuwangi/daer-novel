
import { startWorker } from './queue/worker';
import { io } from './index';

// Start the worker
startWorker(io);

console.log('✅ Worker started successfully');
