# Project Setup Instructions for CX_TIME_LOG

This document provides instructions on how to set up and run the CX_TIME_LOG project locally after cloning it from the Git repository.

## Prerequisites

*   **Node.js**: It's recommended to use a Node.js version compatible with the project. The project uses `@types/node: "^20"`, suggesting Node.js version 20.x or higher is suitable. You can use a Node version manager like `nvm` to manage Node.js versions.
*   **npm**: This project uses npm (Node Package Manager) for managing dependencies. npm is usually installed with Node.js.

## Setup Steps

1.  **Clone the Repository:**
    If you haven't already, clone the project repository to your local machine:
    ```bash
    git clone https://github.com/Daniel-Hillman/CX_TIME_LOG.git
    cd CX_TIME_LOG
    ```

2.  **Install Dependencies:**
    Navigate to the project's root directory (if you're not already there) and install the required Node.js packages using npm:
    ```bash
    npm install
    ```
    This command will download all the dependencies listed in the `package.json` file and place them in the `node_modules` directory.

3.  **Set Up Environment Variables:**
    This project uses environment variables for configuration (e.g., Firebase API keys).
    *   Create a new file named `.env.local` in the root of the project.
    *   Populate this file with **all** required Firebase settings. The application will throw an error if any of these are missing:
        ```
        NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
        NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
        NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
        NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

        # Add any other environment variables required by the application
        # For example, if you are using an external AI service:
        # OPENAI_API_KEY=your_openai_api_key
        ```
    *   Obtain these values from your Firebase project settings. **Do not commit `.env.local` to Git.** It is already included in the `.gitignore` file.

4.  **Run the Development Server:**
    To start the Next.js development server (with Turbopack, as specified in your `scripts`):
    ```bash
    npm run dev
    ```
    This will typically start the application on `http://localhost:9004` (as per your dev script `next dev --turbopack -p 9004`). Open this URL in your web browser to see the application.

5.  **Build for Production:**
    When you want to create a production build of the application:
    ```bash
    npm run build
    ```
    This command will generate an optimized build in the `.next` directory.

6.  **Start in Production Mode:**
    After building, you can start the application in production mode:
    ```bash
    npm run start
    ```

7.  **Linting and Type Checking:**
    The project also includes scripts for linting and type checking:
    *   To lint the code:
        ```bash
        npm run lint
        ```
    *   To perform a TypeScript type check:
        ```bash
        npm run typecheck
        ```

## Firebase Setup Notes

*   Ensure that your Firebase project (`your_project_id` in the environment variables) is correctly set up with Authentication, Firestore, and potentially Cloud Functions if used by the backend.
*   The `firebase.json` file in the repository contains Firebase deployment configurations (hosting, functions). You might need to associate this local project with your Firebase project using the Firebase CLI (`firebase use --add your_project_id`).

By following these steps, you should be able to get the project running locally in your Cursor editor or any other development environment.
