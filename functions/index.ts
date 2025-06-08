import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// Helper to get last working day of the month in UK time
function getLastWorkingDayOfMonthUK(year: number, month: number): Date {
  let lastDay = new Date(Date.UTC(year, month + 1, 0));
  lastDay = new Date(lastDay.toLocaleString('en-GB', { timeZone: 'Europe/London' }));
  while (lastDay.getDay() === 0 || lastDay.getDay() === 6) {
    lastDay.setDate(lastDay.getDate() - 1);
  }
  return lastDay;
}

// Helper to check if now is midnight UK time on the last working day
function isMidnightLastWorkingDayUK(): boolean {
  const now = new Date();
  const ukNow = new Date(now.toLocaleString('en-GB', { timeZone: 'Europe/London' }));
  const month = ukNow.getMonth();
  const year = ukNow.getFullYear();
  const lastWorkingDay = getLastWorkingDayOfMonthUK(year, month);
  return (
    ukNow.getFullYear() === lastWorkingDay.getFullYear() &&
    ukNow.getMonth() === lastWorkingDay.getMonth() &&
    ukNow.getDate() === lastWorkingDay.getDate() &&
    ukNow.getHours() === 0 &&
    ukNow.getMinutes() === 0
  );
}

// Scheduled function: runs every day at midnight UK time
export const adminDayMonthlyReset = functions.pubsub
  .schedule('0 0 * * *') // every day at midnight UTC
  .timeZone('Europe/London')
  .onRun(async (context) => {
    if (!isMidnightLastWorkingDayUK()) {
      return null;
    }
    const advisorsSnap = await db.collection('advisors').get();
    const batch = db.batch();
    const notifications: any[] = [];
    advisorsSnap.forEach(docSnap => {
      const advisor = docSnap.data();
      if (advisor.admin_day_earned && !advisor.admin_day_taken) {
        // Create in-app notification
        notifications.push({
          userId: advisor.firebaseUid,
          type: 'admin_day_reminder',
          message: 'You have earned an Admin Day this month but have not used it. Please use it before the reset.',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          read: false,
        });
      }
      // Reset fields
      batch.update(docSnap.ref, {
        monthly_meeting_hours: 0,
        admin_day_earned: false,
        admin_day_taken: false,
      });
    });
    // Write notifications
    for (const notif of notifications) {
      await db.collection('notifications').add(notif);
    }
    await batch.commit();
    return null;
  }); 