export type Advisor = {
  id: string;
  userId: string; // Add userId field
  name: string;
};

export type LoggedEvent = {
  id: string;
  userId: string; // Add userId field
  date: string; // Store date as string in ISO format (YYYY-MM-DD)
  advisorId: string;
  eventTitle: string;
  loggedTime: number; // Logged time in minutes
};
