# **App Name**: CX TIME LOG

## Core Features:

- Time Logging: Enable users to log time spent on tasks, including date, advisor, event title, time to be logged (10 min, 20, min etc). Automatically calculate and store the logged time.
- Event Listing & Filtering: Display logged events in a list format, filterable by date. Show the date, advisor, event title, start time, end time, and logged time for each event.
- Advisor Management: Allow administrators to add and remove advisors. Store the advisor list locally and persist it in local storage. Ensure unique advisor names.

## Style Guidelines:

- Primary color: Teal (#008080) for a professional and calming feel.
- Secondary color: Light gray (#F0F0F0) for backgrounds and neutral elements.
- Accent: Amber (#FFBF00) for interactive elements like buttons and highlights.
- Clean and readable sans-serif font for the main content.
- Simple, outline-style icons for actions and navigation.
- Use a grid-based layout for a structured and organized appearance.
- Subtle transitions and animations for user interactions (e.g., button hover effects, form input focus).

## Original User Request:
You are an expert full-stack developer specializing in React, Next.js, and Firebase. Your task is to generate the complete code for a new application called "cx-time-log" based on the following specifications. The code should be production ready.

**Application Description:**

"cx-time-log" is a time-logging application designed for a small team. Users should be able to:

*   **Log Time:** Record time spent on various tasks or events.
*   **View Logs:** See a list of logged events, potentially organized by date or advisor.
*   **Manage Advisors:** Add or remove team members (advisors).
* **Memory:** the app should have memory in a way that users changes are not lost upon reload. this should be accomplished using localstorage.

**Technical Requirements:**

1.  **Frontend:**
    *   **Framework:** Use React with Next.js (latest version).
    *   **UI:** Create a clear and intuitive user interface.
    *   **Components:** Design reusable React components.
    * **Local storage:** All user changes must be stored in the local storage so that upon a reload the data is not lost.

2.  **Backend (Simulated/In-Memory):**
    *   **No External Database:**  Do not use Firestore or any other external database.
    *   **Data Storage:** Store all data in memory within the application. You can use JavaScript data structures (arrays, objects) to hold this data.
    *   **Persistence (Simulated):** The only data persistence should be using the localstorage so the data is not lost upon reload.
    *   **Data Structures:** You will need to define the following data structures:
        *   `LoggedEvent`: An object representing a logged event (e.g., { id, date, advisorName, eventTitle, startTime, endTime, loggedTime }).
        *   `Advisor`: An object representing a team member (e.g., { id, name }).

3.  **Functionality:**
    *   **Time Logging:**
        *   Create a form or interface for users to log a new event.
        *   Include fields for date, advisor, event title, start time, end time, and calculated logged time.
        *   Store this event in memory.
    *   **Event Listing:**
        *   Display a list of all logged events.
        *   Implement filtering by date.
    *   **Advisor Management:**
        *   Create a way to add new advisors.
        *   Create a way to remove advisors.
        *   Store the list of advisors in memory.
    * **App Memory:** implement logic that checks the local storage in the page load, if the data exists then it should set it as the current state.
        * Save all data to the local storage after every change.

4.  **Deployment:**
    *   The application should be designed to be easily deployable to Firebase Hosting.
    *   Ensure that the build process and file structure are compatible with Firebase Hosting.
    *   Do not include any firebase init logic.

5.  **No User Logins:**
    *   Do not implement user authentication or login systems.
    *   Do not use firebase auth.

6.  **Code Style:**
    *   Write clean, well-commented code.
    *   Follow React and Next.js best practices.
    *   Use TypeScript for type safety.

**Instructions for the LLM:**

1.  **Generate Complete Code:** Create all the necessary files and code for the application, including components, pages, data structures, and logic.
2.  **File Structure:** Organize the code into a logical file structure (e.g., `src/`, `components/`, `pages/`, etc.).
3.  **React Components:** Create well-defined React components for the UI.
4. **No unnecessary files:** generate only the files required to run this app
5. **No errors:** make sure there are no errors in the generated code
6. **Use the latest versions:** use the latest version of all dependencies.
  