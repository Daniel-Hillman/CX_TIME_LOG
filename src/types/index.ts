
// Defines the standard, predefined event types users can select from.
export const standardEventTypes = [
  "Meeting",
  "Training",
  "Doctor",
  "Dentist",
  "Family care",
  "Learning",
  "Exam/Study",
  "Task work", // Added Task work
  "Charity",   // Added Charity
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

// Removed Task type definition
// export type Task = { ... };

// Represents a single logged event or time entry.
export type LoggedEvent = {
  id: string; // Unique identifier for the event.
  userId: string; // Identifier of the user who logged the event.
  advisorId: string; // Identifier of the advisor the event is associated with.
  // Removed taskId field
  // taskId?: string | null;
  date: string; // Date of the event (ISO string format: YYYY-MM-DD).
  eventType: StandardEventType | string; // Type of event, either predefined or custom.
  eventDetails?: string | null; // Optional additional details about the event.
  loggedTime: number; // Time spent in minutes.
};


// Represents the structure for app settings, potentially stored locally.
export interface AppSettings {
  theme: 'light' | 'dark' | 'system'; // Current theme preference.
  // Add other settings as needed
}
