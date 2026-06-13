import { closeExpiredPolls } from './poll.service.js';

let pollTimer: NodeJS.Timeout | null = null;
let isProcessing = false;

async function runPollCycle() {
  if (isProcessing) {
    return;
  }

  isProcessing = true;
  try {
    await closeExpiredPolls();
  } catch (error) {
    console.error('Error processing poll scheduler:', error);
  } finally {
    isProcessing = false;
  }
}

export function startPollScheduler() {
  if (pollTimer) {
    return;
  }

  void runPollCycle();
  pollTimer = setInterval(() => {
    void runPollCycle();
  }, 30_000);
}
