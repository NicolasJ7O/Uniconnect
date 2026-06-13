import { processStudySessionReminders } from './study-session.service.js';

let reminderTimer: NodeJS.Timeout | null = null;
let isProcessing = false;

async function runReminderCycle() {
  if (isProcessing) {
    return;
  }

  isProcessing = true;
  try {
    await processStudySessionReminders();
  } catch (error) {
    console.error('Error processing study session reminders:', error);
  } finally {
    isProcessing = false;
  }
}

export function startStudySessionScheduler() {
  if (reminderTimer) {
    return;
  }

  void runReminderCycle();
  reminderTimer = setInterval(() => {
    void runReminderCycle();
  }, 30_000);
}

