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

// Defines the structure for advisor permissions
export type AdvisorPermissions = {
  canAccessTimeLog: boolean;
  canAccessPolicySearch: boolean;
  canAccessNextClearedBatch: boolean;
  canAccessWholeOfMarket: boolean;
  canAccessAgentTools: boolean;
  canAccessVisualisations: boolean;
  canAccessSummary: boolean;
  canAccessReports: boolean;
  canManageAdvisors: boolean;
  hasTopAccess: boolean;
  canViewAllEvents: boolean;
};

// Represents an advisor entity, typically associated with logged events.
export type Advisor = {
  id: string; // Unique identifier for the advisor document in Firestore.
  name: string; // Display name of the advisor.
  email: string; // Email address of the advisor, used for pre-approval and login.
  status: 'pending' | 'active'; // Status of the advisor's account.
  addedByAdminUid: string; // Firebase UID of the admin who added this advisor.
  firebaseUid?: string; // Firebase UID of the advisor after they successfully sign up.
  permissions: AdvisorPermissions; // Permissions for the advisor
};

// Represents a single logged event or time entry.
export type LoggedEvent = {
  id: string; // Unique identifier for the event.
  userId: string; // Identifier of the user who logged the event.
  advisorId: string; // Identifier of the advisor the event is associated with.
  date: string; // Date of the event (ISO string format: YYYY-MM-DD).
  eventType: StandardEventType | string; // Type of event, ideally predefined but allow string for flexibility from DB.
  eventDetails?: string | null; // Optional additional details about the event.
  loggedTime: number; // Time spent in minutes.
  timestamp: string; // ISO string representation of the Firestore Timestamp (last modified/created)
  startTime?: string; // Start time in HH:mm format (24-hour)
  endTime?: string; // End time in HH:mm format (24-hour)
};


// Represents the structure for app settings, potentially stored locally.
export interface AppSettings {
  theme: 'light' | 'dark' | 'system'; // Current theme preference.
  // Add other settings as needed
}
