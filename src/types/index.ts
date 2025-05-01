// Defines the standard, predefined event types users can select from.
export const standardEventTypes = [
  "Meeting",
  "Training",
  "Doctor",
  "Dentist",
  "Family care",
  "Learning",
  "Exam/Study",
  "Other", // Allows for custom events not covered by predefined types.
] as const; // 'as const' ensures the array elements are treated as literal types.

// Creates a TypeScript union type from the standardEventTypes array.
// This allows ensuring that variables or parameters can only hold one of these specific string values.
export type StandardEventType = typeof standardEventTypes[number];

// Represents an advisor entity, typically associated with logged events.
export type Advisor = {
  id: string; // Unique identifier for the advisor.
  userId: string; // Identifier of the user who manages this advisor.
  name: string; // Display name of the advisor.
};

// *** ADD Task Type ***
// Represents a task or project that time can be logged against.
export type Task = {
  id: string;       // Unique identifier for the task.
  userId: string;   // Identifier of the user who owns this task.
  name: string;       // Display name of the task.
  description?: string; // Optional description for the task.
};

// Represents a single time log entry created by a user.
export type LoggedEvent = {
  id: string; // Unique identifier for the logged event.
  userId: string; // Identifier of the user who logged the event.
  date: string; // Date of the event, stored as a string in ISO format (YYYY-MM-DD).
  advisorId: string; // Identifier of the advisor associated with this event.
  taskId?: string; // *** ADD Optional identifier for the task associated with this event ***
  eventType: StandardEventType; // The category or type of the event, constrained by StandardEventType.
  eventDetails?: string; // Optional field for additional details, particularly used when eventType is 'Other'.
  loggedTime: number; // Duration of the event logged, typically in minutes.
};
