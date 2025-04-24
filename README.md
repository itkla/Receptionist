# Receptionist - Shipment & Device Management Dashboard

## Brief Description

Receptionist is an internal web application built with Next.js designed for managing shipments, associated devices, destinations, users, and related administrative tasks.

## Overview & Features

This application provides a dashboard interface for administrators to track and manage the lifecycle of shipments and their contents.

**Key Features:**

*   **Authentication:** Secure user login using NextAuth.js credentials provider, including password reset functionality via email (Resend).
*   **Shipment Management:** Create, view, update, and delete shipment manifests. Track status, sender/recipient details, associated devices, tracking numbers, and notes.
*   **Device Tracking:** Associate devices (by serial number, asset tag, model) with shipments. Mark devices as checked-in upon receipt.
*   **Destination Management:** View and manage shipment destination locations.
*   **User Management:** Add, view, edit (name, email, password, notification preferences), and delete administrator users.
*   **Settings:** Configure application settings (e.g., admin notification emails).
*   **API Key Management:** Generate and manage API keys for potential external integrations (details inferred).
*   **Email Notifications:** Sends password reset emails using Resend.
*   **Responsive UI:** Built with Tailwind CSS and shadcn/ui components for a consistent look and feel.
*   **Dark/Light Mode:** Theme toggle included.

**Technology Stack:**

*   Framework: Next.js (App Router)
*   Language: TypeScript
*   Styling: Tailwind CSS, shadcn/ui
*   Database: PostgreSQL (via Prisma ORM)
*   Authentication: NextAuth.js
*   Email: Resend
*   Validation: Zod
*   Icons: Tabler Icons
*   Other Libraries: bcryptjs, date-fns, react-email (inferred)

## Installation

Follow these steps to set up the project locally:

1.  **Prerequisites:**
    *   Node.js (Latest LTS version recommended)
    *   pnpm (or npm/yarn)
    *   PostgreSQL database running

2.  **Clone the repository:**
    ```bash
    git clone https://github.com/itkla/receptionist
    cd receptionist
    ```

3.  **Install dependencies:**
    ```bash
    pnpm install
    # or npm install / yarn install
    ```

4.  **Set up environment variables:**
    *   Copy the example environment file:
        ```bash
        cp .env.example .env
        ```
    *   Edit the `.env` file and provide the necessary values. Key variables include:
        *   `DATABASE_URL`: Your PostgreSQL connection string.
        *   `NEXTAUTH_SECRET`: A strong secret for signing JWTs (generate one using `openssl rand -base64 32`).
        *   `NEXTAUTH_URL`: The base URL of your application (e.g., `http://localhost:3000` for development).
        *   `RESEND_API_KEY`: Your API key from Resend.com (required for password reset emails).
        *   *(Check `.env.example` for any other required variables)*

5.  **Set up the database:**
    *   Apply database migrations:
        ```bash
        pnpm exec prisma migrate dev
        ```
    *   Generate Prisma Client:
        ```bash
        pnpm exec prisma generate
        ```

6.  **Run the development server:**
    ```bash
    pnpm dev
    # or npm run dev / yarn dev
    ```

7.  Open [http://localhost:3000](http://localhost:3000) in your browser. If it's the first run and no users exist, you might be redirected to `/setup-admin` or need to create an initial user manually (via cli.ts) or via seeding.

## API Route Documentation

The application uses Next.js API routes primarily located under `/src/app/api/`. Authentication (session check) is required for most admin routes.

**Authentication (`/api/auth/`)**

*   Managed by NextAuth.js (`[...nextauth]/route.ts`)
*   `POST /api/auth/request-password-reset`: Initiates the password reset flow (sends email). Requires email in body.
*   `POST /api/auth/reset-password`: Completes the password reset. Requires plain token and new password in body.

**Users (`/api/admin/users/`)**

*   `GET /api/admin/users`: Fetches a list of all users. (Admin Auth)
*   `POST /api/admin/users`: Creates a new user. Requires name, email, password. (Admin Auth)
*   `GET /api/admin/users/[userId]`: Fetches details for a specific user. (Admin Auth)
*   `PUT /api/admin/users/[userId]`: Updates a specific user. Requires name, email, notificationsEnabled; optional password. (Admin Auth)
*   `DELETE /api/admin/users/[userId]`: Deletes a specific user. (Admin Auth)

**Shipments (`/api/shipments/`, `/api/admin/shipments/`)**

*   `GET /api/shipments`: Fetches a list of shipments with pagination, sorting, filtering, and search. (Auth Required)
*   `POST /api/shipments`: Creates a new shipment. Requires sender details, location, devices. (Auth Required)
*   `GET /api/shipments/[shortId]`: Fetches details for a specific shipment by its short ID. (Auth Required)
*   `PUT /api/shipments/[shortId]`: Updates details for a specific shipment. (Auth Required)
*   `DELETE /api/shipments/[shortId]`: Deletes a specific shipment. (Auth Required)
*   `PUT /api/admin/shipments/[shipmentId]/verify`: Verifies devices received for a shipment, updating status. (Admin Auth - Inferred)

**Locations (`/api/admin/locations/`)**

*   `GET /api/admin/locations`: Fetches a list of all destination locations. (Admin Auth)
*   *(Other potential endpoints like GET/PUT/DELETE for `[locationId]` might exist)*

**Settings (`/api/admin/settings/`)**

*   `GET /api/admin/settings/email`: Fetches admin email notification settings. (Admin Auth)
*   `PUT /api/admin/settings/email`: Updates admin email notification settings. (Admin Auth)

**API Keys (`/api/admin/apikeys/`)**

*   `GET /api/admin/apikeys`: Fetches a list of API keys (excluding hash). (Admin Auth)
*   `POST /api/admin/apikeys`: Generates a new API key. Requires description. Returns the key *once*. (Admin Auth)
*   `PATCH /api/admin/apikeys/[keyId]`: Updates an API key (e.g., activate/deactivate). (Admin Auth)
*   `DELETE /api/admin/apikeys/[keyId]`: Deletes an API key. (Admin Auth - Inferred)

*(Note: This is based on observed routes. Refer to the specific route files for detailed request/response structures and full validation logic.)*
