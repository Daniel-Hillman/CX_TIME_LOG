import { LoggedEvent, Advisor } from '../types';
import { updateAdvisorMeetingHoursAndEligibility } from './firestoreService';

// Get the current month and year in UK timezone
function getCurrentMonthYearUK() {
  const now = new Date();
  // Convert to UK time (Europe/London)
  const ukNow = new Date(now.toLocaleString('en-GB', { timeZone: 'Europe/London' }));
  return { month: ukNow.getMonth(), year: ukNow.getFullYear() };
}

// Sum meeting hours for each advisor for the current month and update eligibility
export async function updateAllAdvisorsMeetingHours(
  loggedEvents: LoggedEvent[],
  advisors: Advisor[]
) {
  const { month, year } = getCurrentMonthYearUK();
  // Map advisorId to total meeting minutes
  const advisorMeetingMinutes: Record<string, number> = {};
  for (const event of loggedEvents) {
    if (
      event.eventType === 'Meeting' &&
      event.date &&
      new Date(event.date).getMonth() === month &&
      new Date(event.date).getFullYear() === year
    ) {
      advisorMeetingMinutes[event.advisorId] =
        (advisorMeetingMinutes[event.advisorId] || 0) + (event.loggedTime || 0);
    }
  }
  // Update each advisor in Firestore
  for (const advisor of advisors) {
    const minutes = advisorMeetingMinutes[advisor.id] || 0;
    await updateAdvisorMeetingHoursAndEligibility(advisor.id, minutes);
  }
}

// Returns the last working day (Mon-Fri) of the given month/year in UK timezone
export function getLastWorkingDayOfMonthUK(year: number, month: number): Date {
  // month is 0-indexed
  let lastDay = new Date(Date.UTC(year, month + 1, 0)); // last day of month
  // Convert to UK time
  lastDay = new Date(lastDay.toLocaleString('en-GB', { timeZone: 'Europe/London' }));
  // If Sat/Sun, go back to Friday
  while (lastDay.getDay() === 0 || lastDay.getDay() === 6) {
    lastDay.setDate(lastDay.getDate() - 1);
  }
  return lastDay;
}

// Checks if now (UK time) is midnight on the last working day of the month
export function isMidnightLastWorkingDayUK(): boolean {
  const now = new Date();
  const ukNow = new Date(now.toLocaleString('en-GB', { timeZone: 'Europe/London' }));
  const { month, year } = getCurrentMonthYearUK();
  const lastWorkingDay = getLastWorkingDayOfMonthUK(year, month);
  return (
    ukNow.getFullYear() === lastWorkingDay.getFullYear() &&
    ukNow.getMonth() === lastWorkingDay.getMonth() &&
    ukNow.getDate() === lastWorkingDay.getDate() &&
    ukNow.getHours() === 0 &&
    ukNow.getMinutes() === 0
  );
} 