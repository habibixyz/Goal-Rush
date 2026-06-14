import { runPollingJob } from './cron/poll.js';

console.log('[Collector] Starting Live Match Collector...');

// Execute immediately on start
runPollingJob();

// Poll every 15 seconds
const POLL_INTERVAL = 15000;
setInterval(runPollingJob, POLL_INTERVAL);

// Handle graceful shutdowns
process.on('SIGINT', async () => {
  console.log('[Collector] Gracefully shutting down...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[Collector] Gracefully shutting down...');
  process.exit(0);
});
