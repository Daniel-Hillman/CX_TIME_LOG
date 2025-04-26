export type Advisor = {
  id: string;
  name: string;
};

export type LoggedEvent = {
  id: string;
  date: string; // Store date as string in ISO format (YYYY-MM-DD)
  advisorId: string;
  eventTitle: string;
  loggedTime: number; // Logged time in minutes
};
