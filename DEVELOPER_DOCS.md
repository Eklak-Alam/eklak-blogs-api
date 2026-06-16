# Gaprio Blogs Backend - Developer Documentation

## 1. Project Overview & Architecture

### Overview
Gaprio Blogs Backend is a robust, production-ready API engine designed to power a modern blog and content management system. It handles user authentication, role-based access control, rich text blog post management, taxonomy (categories and tags), user interactions (comments, likes, bookmarks), and object storage integration.

### Architectural Patterns
The application follows a **Modular Monolith** architecture with an **MVC-inspired** structure (Model-View-Controller) adapted for a RESTful API:
- **Feature-Based Modules:** Instead of grouping all controllers or services together, the codebase is organized by feature domain (e.g., `auth`, `post`, `user`) under `src/modules/`. Each module contains its own routes, controller, service, and validation logic.
- **Service Layer Pattern:** Controllers handle the HTTP request/response cycle, while business logic and database interactions are delegated to the Service layer (`*.service.js`).
- **Validation Pipeline:** A strict middleware pipeline ensures all incoming data is validated using Zod before reaching the controllers.
- **Centralized Error Handling:** Global error handling middleware intercepts application errors, translating them into consistent API responses, while `server.js` manages graceful process shutdowns on uncaught exceptions.

### Data Flow
1. **Request:** Client makes an HTTP request to an endpoint.
2. **Global Middlewares:** The request passes through security and utility middlewares (Helmet, CORS, Rate Limiter, Body Parser).
3. **Router (`routes/index.js`):** Routes direct the request to the appropriate module router.
4. **Validation Pipeline (`validate`):** Zod schemas rigorously validate the request body, query, and parameters.
5. **Auth Guards (`protect` / `restrictTo`):** For protected routes, JWT tokens are verified and user roles are checked.
6. **Controller:** Handles the HTTP layer, extracting data and passing it to the Service.
7. **Service:** Executes core business logic and interacts with the database via Prisma ORM.
8. **Response:** The Controller formats the Service's output and sends a JSON response back to the client.

---

## 2. Folder & Directory Structure

```text
gaprio-blogs-backend/
├── .env                  # Environment variables
├── package.json          # Project metadata and dependencies
├── prisma/               # Database ORM configuration
│   └── schema.prisma     # Prisma database schema definition
└── src/                  # Main application source code
    ├── app.js            # Express app setup and global middlewares
    ├── server.js         # Entry point, DB connection, server initialization
    ├── config/           # Configuration files (env parsing, DB client)
    ├── middlewares/      # Global Express middlewares (auth, error, validate)
    ├── modules/          # Feature-based domain modules
    │   ├── auth/         # Authentication and session management
    │   ├── category/     # Taxonomy (Categories and Tags)
    │   ├── interaction/  # Comments, Likes, and Bookmarks
    │   ├── post/         # Blog post creation and management
    │   └── user/         # User profile and admin management
    ├── routes/           # Master API router
    └── utils/            # Shared utilities (errors, responses, email, storage)
```

### Major Directory Responsibilities
- **`src/modules/`:** The core of the application. Each subfolder encapsulates everything needed for a specific domain (routes, validation schemas, controllers, services).
- **`src/middlewares/`:** Contains application-wide logic that intercepts requests, such as JWT authentication (`auth.middleware.js`), payload validation (`validate.middleware.js`), and centralized error formatting (`error.middleware.js`).
- **`src/utils/`:** Reusable helper functions, including `catchAsync` to avoid repetitive try-catch blocks, custom `AppError` classes, and integrations like Cloudflare R2 storage (`r2.storage.js`).
- **`prisma/`:** Defines the database tables, relations, and enums. It is the single source of truth for the database schema.

---

## 3. Dependencies & Tech Stack

### Core Tech Stack
- **Framework:** Express.js (v5)
- **Database:** MySQL
- **ORM:** Prisma Client

### Major Dependencies and Roles
- **`@prisma/client` & `prisma`:** The Object-Relational Mapper (ORM) used to interact with the MySQL database. It provides type-safe queries and database migrations.
- **`zod`:** Schema declaration and validation library. Used extensively to validate incoming request bodies and prevent malformed data from reaching the database.
- **`jsonwebtoken` & `jose`:** Handles the generation and verification of JSON Web Tokens (JWT) for stateless user authentication.
- **`bcrypt` / `bcryptjs`:** Cryptographic hashing libraries used to securely hash user passwords before storing them.
- **`express-rate-limit` & `helmet`:** Security middlewares to protect against brute-force attacks, volumetric DDoS, and secure HTTP headers.
- **`cors`:** Manages Cross-Origin Resource Sharing, allowing the frontend to securely communicate with the API.
- **`resend`:** Used for sending transactional emails (e.g., email verification, password resets).
- **`@aws-sdk/client-s3`:** Despite the AWS name, this SDK is used to interact with Cloudflare R2 storage (which is S3-compatible) for handling file and media uploads.
- **`multer`:** Middleware for handling `multipart/form-data`, primarily used for parsing file uploads before sending them to Cloudflare R2.

---

## 4. Environment Variables & Setup

### Required Environment Variables
Below are the environment variables required for the backend to function correctly:

| Variable | Description |
|---|---|
| `DATABASE_URL` | The MySQL connection string (Format: `mysql://USER:PASSWORD@HOST:PORT/DB_NAME`). |
| `PORT` | The port the Express server will listen on (default: `8000`). |
| `NODE_ENV` | The environment mode (`development` or `production`). |
| `JWT_SECRET` | Secret key for signing JWTs. Must be highly secure and at least 32 characters long. |
| `JWT_EXPIRES_IN` | The lifespan of the JWT (e.g., `15m`, `7d`). |
| `RESEND_API_KEY` | API key for the Resend email service. |
| `FROM_EMAIL` | The sender email address for system emails (e.g., `hello@gaprio.com`). |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID for R2 storage access. |
| `CLOUDFLARE_ACCESS_KEY` | Cloudflare R2 access key. |
| `CLOUDFLARE_SECRET_KEY` | Cloudflare R2 secret key. |
| `CLOUDFLARE_BUCKET_NAME` | The target bucket name for storing media assets. |
| `CLOUDFLARE_PUBLIC_DOMAIN`| The public domain URL to access uploaded objects. |

### Local Setup Instructions

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   Create a `.env` file in the root directory and populate it with the variables listed above based on your local database and third-party service credentials.

3. **Database Setup (Prisma):**
   Generate the Prisma Client based on the schema:
   ```bash
   npm run db:generate
   ```
   Push the schema to your local MySQL database:
   ```bash
   npm run db:push
   ```
   *(Optional)* Open Prisma Studio to view and manage data visually:
   ```bash
   npm run db:studio
   ```

4. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   The server should now be running at `http://localhost:8000`.

---

## 5. API Routing & Endpoints Reference

Base API Route: `/api/v1`

### Authentication (`/auth`)
| Method | Route | Description |
|---|---|---|
| `POST` | `/auth/register` | Register a new user account. |
| `POST` | `/auth/login` | Authenticate user and receive JWT. |
| `POST` | `/auth/verify-email` | Verify a user's email address. |
| `POST` | `/auth/resend-verification`| Resend the email verification link. |
| `POST` | `/auth/refresh` | Refresh the authentication session. |
| `POST` | `/auth/logout` | Terminate the user session. |
| `POST` | `/auth/forgot-password` | Initiate password recovery flow. |
| `POST` | `/auth/reset-password` | Reset password using a recovery token. |

### Users (`/users`)
| Method | Route | Description |
|---|---|---|
| `GET` | `/users/:id/public` | Get public profile of a user/author. |
| `GET` | `/users/me` | [Protected] Get current user's profile. |
| `PATCH` | `/users/me` | [Protected] Update current user's profile. |
| `PATCH` | `/users/me/password`| [Protected] Change password. |
| `DELETE`| `/users/me` | [Protected] Delete own account. |
| `GET` | `/users/` | [Admin] Get all users. |
| `PATCH` | `/users/:id/role` | [Admin] Update a user's role. |
| `PATCH` | `/users/:id/ban` | [Admin] Toggle ban status of a user. |
| `DELETE`| `/users/:id` | [Admin] Permanently delete a user. |

### Taxonomy: Categories & Tags (`/categories`, `/tags`)
| Method | Route | Description |
|---|---|---|
| `GET` | `/categories` | Get all categories. |
| `GET` | `/categories/:slug` | Get a specific category by its slug. |
| `POST` | `/categories` | [Admin] Create a new category. |
| `PATCH` | `/categories/:id` | [Admin] Update an existing category. |
| `DELETE`| `/categories/:id` | [Admin] Delete a category. |
| `GET` | `/tags` | Get all tags. |
| `POST` | `/tags` | [Admin] Create a new tag. |
| `PATCH` | `/tags/:id` | [Admin] Update an existing tag. |
| `DELETE`| `/tags/:id` | [Admin] Delete a tag. |

### Blog Posts (`/posts`)
| Method | Route | Description |
|---|---|---|
| `GET` | `/posts` | Get all published posts. |
| `GET` | `/posts/:slug` | Get a specific published post by slug. |
| `GET` | `/posts/me` | [Protected] Get posts written by the current user. |
| `POST` | `/posts` | [Protected: Writer+] Create a new post. |
| `PATCH` | `/posts/:id` | [Protected: Writer+] Update own post. |
| `DELETE`| `/posts/:id` | [Protected: Writer+] Delete own post. |
| `GET` | `/posts/admin/all` | [Admin] Get all posts regardless of status. |
| `PATCH` | `/posts/admin/:id/status`| [Admin] Force update post status. |
| `DELETE`| `/posts/admin/:id/force` | [Admin] Force delete any post. |

### User Interactions (`/posts/:postId`, `/comments`)
| Method | Route | Description |
|---|---|---|
| `GET` | `/posts/:postId/comments` | Get all comments for a post. |
| `POST` | `/posts/:postId/comments` | [Protected] Add a comment to a post. |
| `POST` | `/posts/:postId/like` | [Protected] Toggle like on a post. |
| `POST` | `/posts/:postId/bookmark` | [Protected] Toggle bookmark on a post. |
| `PATCH` | `/comments/:id` | [Protected] Edit an owned comment. |
| `DELETE`| `/comments/:id` | [Protected] Delete an owned comment. |
| `PATCH` | `/comments/:id/moderate` | [Admin] Moderate/hide a comment. |

---

## 6. Core Logic & Implementation Details

### Security & Validation Pipeline
The application utilizes a rigorous "First Line of Defense" strategy. Every API route uses the `validate` middleware backed by **Zod schemas**. This guarantees that missing fields, incorrect data types, or invalid formats are rejected with a `400 Bad Request` before the controller logic is ever invoked. Furthermore, global security is enforced via `helmet` (HTTP headers) and `express-rate-limit` to thwart automated attacks.

### Robust Role-Based Access Control (RBAC)
Authorization is managed using a strict, multi-layered approach. The database enforces Enum roles (`USER`, `WRITER`, `AUTHOR`, `ADMIN`). 
The `auth.middleware.js` exports two key functions:
1. `protect`: Verifies the JWT signature, checks if the token has expired, ensures the user hasn't been deleted or banned, and attaches the user object to the `req` context.
2. `restrictTo(...roles)`: Follows the `protect` middleware and strictly limits endpoint access based on the user's role array. 
For example, author-specific routes use `restrictTo('WRITER', 'AUTHOR', 'ADMIN')`, while destructive operations are locked behind `restrictTo('ADMIN')`.

### Cloudflare R2 / AWS S3 Integration
The system integrates with Cloudflare R2 for highly available object storage (images, media) using the standard `@aws-sdk/client-s3`. 
The `r2.storage.js` utility manages connection pooling and provides methods for generating signed URLs. Instead of processing massive files directly through the Express server (which blocks the Node.js event loop), the backend generates pre-signed URLs allowing clients to upload assets directly to Cloudflare R2 securely. This architectural decision significantly improves performance and scalability for media-heavy blog applications.
