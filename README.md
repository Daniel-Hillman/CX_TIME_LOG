
# Tempo - CX Time Logging & Policy Management App

Tempo is a comprehensive web application designed to assist employees with time logging, policy information management, and administrative tasks. It leverages Firebase for backend services and is built with Next.js, React, and ShadCN UI components for a modern and responsive user experience.

## Key Features

### 1. Authentication
-   **Email & Password Login:** Secure login for registered users.
-   **Sign Up:** New users can sign up, restricted to `@clark.io` email domains for internal use.
-   **Session Management:** Firebase handles user sessions and authentication state.

### 2. Time Logging
-   **Log New Entries:** Users can log time spent on various activities.
    -   Fields: Date, Advisor, Event Type, Logged Time (minutes), Event Details (for 'Other' type).
-   **Standard Event Types:** Predefined list includes Meeting, Training, Doctor, Dentist, Family care, Learning, Exam/Study, Task work, Charity, and Other.
-   **Edit & Delete Logs:** Users can modify or remove their own logged entries. Administrators have privileges to edit or delete any log.
-   **Real-time Updates:** Logged events are displayed and updated in real-time.

### 3. Advisor Management (Admin Only)
-   **Add Advisors:** Administrators can add new advisors to the system.
-   **Edit Advisor Names:** Existing advisor names can be updated.
-   **Remove Advisors:** Advisors can be removed, provided they have no logged time entries associated with them.

### 4. Dashboard & Summaries
-   **Time Log Summary (Admin Only):** Provides a consolidated view of time logged per advisor for "Today," "This Week," and "This Month."
-   **Event List:** Displays all logged events with filtering options:
    -   Search by keyword (advisor name, event type, details for 'Other').
    -   Filter by date range (predefined and custom).
    -   Filter by specific advisor.
    -   Sort by date, advisor, event type, or logged time.
    -   Option to view only today's logs.
    -   Comments on "Other" events are hidden from non-admin users unless they are the author of the log.

### 5. Reports Section
-   **Detailed Reporting:** View tabular data of logged events.
-   **Advanced Filtering:**
    -   Date range presets (Today, This Week, Last 7/30 Days, This Month, This Year) and custom date range selection.
    -   Filter by specific advisor.
    -   Filter by event type.
-   **Data Export:** Export the filtered report data to a CSV file.

### 6. Visualizations Section (Admin Only)
-   **Graphical Insights:** Visual representation of logged time data.
-   **Charts:**
    -   **Time Logged Per Advisor:** Bar chart.
    -   **Advisor Time Distribution:** Doughnut chart.
    -   **Daily Time Log Trend:** Line chart.
-   **Interactive Filtering:** Same filtering capabilities as the Reports section apply to visualizations.
-   **Image Export:** Export the current view of visualizations as a PNG image.

### 7. Policy Search
-   **CSV Upload:** Users can upload a daily policy dashboard (CSV format).
-   **Policy Lookup:** Search for specific policies by their number within the uploaded data.
-   **Detailed View:** Displays key information for a found policy:
    -   Policy Number, Status, Missed Payments.
    -   Potential Cancellation Date (calculated for 'ON_RISK' policies with 3 missed payments).
    -   Current Gross Premium Per Frequency.
    -   Max. Next Premium Collection Date.
    -   Number Of Paid Premiums.
    -   Indication if the "next payment has cleared" based on specific criteria.

### 8. Next Cleared Batch Processing
-   **Dual File Upload:** Requires a daily dashboard CSV and a "cleared batch" file (CSV or TXT containing policy numbers).
-   **Automated Matching:** Identifies policies from the dashboard that are present in the cleared batch file and meet the "next payment cleared" criteria (1 or 2 previous missed payments, next scheduled collection is after the inferred cleared date, and 5+ days have passed since inferred cleared date).
-   **Results Display:**
    -   Matching policies are displayed in an accordion, sorted numerically by policy number.
    -   Key details shown: Status, Missed Payments, Next Premium Collection, Starting Date.
    -   Option to copy policy numbers to the clipboard.
-   **Data Export:** Download processed results as:
    -   Full data CSV (for general use).
    -   TXT report (summarized details).
    -   CSV for Sheets (optimized for Google Sheets import, previously "PDF (Text)" button).

### 9. Whole Of Market Section
-   **Insurer Information Hub:** Provides a comprehensive, scrollable table of insurer details.
-   **Key Data Points:** Insurer Name, Contact Information, Auto-Recollection status, Lapse criteria (missed payments), Cancellation on behalf policy, DD Reinstatement policy, other retention notes, login details, and bank details.
-   **User-Friendly Interface:**
    -   Searchable by insurer name.
    -   Frozen header row and first column (Insurer) for easy reference while scrolling.

### 10. User Interface & Experience
-   **Theme Customization:** Light, Dark, and System theme options.
-   **Modern Stack:** Built with Next.js (App Router), React, and TypeScript.
-   **UI Components:** Utilizes ShadCN UI for a consistent and professional look and feel.
-   **Styling:** Tailwind CSS for utility-first styling.
-   **Responsive Design:** Adapts to various screen sizes for accessibility on desktop and mobile devices.
-   **Notifications:** User-friendly toast notifications for actions, successes, and errors.
-   **Custom Fonts:** Incorporates 'Inter' (sans-serif), 'Minecraft', and 'Designer' fonts for distinct visual elements.

## Technical Stack
-   **Frontend:** Next.js, React, TypeScript
-   **UI Library:** ShadCN UI, Tailwind CSS
-   **Backend & Database:** Firebase (Authentication, Firestore)

## Getting Started
(Instructions for local setup, development, and deployment would typically go here if this were a public repository. For internal use, this section might cover specific setup notes for team members.)

## Important Notes
-   **Admin Privileges:** Certain features and data views are restricted to admin users. Admin users are currently hardcoded in `src/app/page.tsx`.
-   **CSV Data Sensitivity:** The Policy Search and Next Cleared Batch features rely on CSV uploads. Ensure data privacy and security measures are considered if handling sensitive policyholder information.
-   **Firebase Configuration:** The Firebase project configuration is stored in `src/lib/firebase.ts`. API keys and project details should be secured.
-   **Policy Logic:** The "next payment cleared" logic in both Policy Search and Next Cleared Batch features is based on specific business rules (e.g., number of missed payments, timing of next collection).

This README provides a detailed overview of the Tempo application. For further details on specific components or logic, please refer to the source code and inline comments.
