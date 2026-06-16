# Gaprio Blogs API 🚀

A production-ready RESTful API engine that powers the **Gaprio Blogs** platform — a modern content management and blogging system. It handles everything from user authentication and role-based access control to rich blog post management, taxonomy (categories & tags), user interactions (comments, likes, bookmarks), and cloud-based media storage.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [API Endpoints](#api-endpoints)
  - [Authentication](#authentication-auth)
  - [Users](#users-users)
  - [Blog Posts](#blog-posts-posts)
  - [Categories & Tags](#categories--tags-categories-tags)
  - [Interactions](#interactions-posts-postid-comments)
- [Security](#security)
- [Database Schema](#database-schema)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

The Gaprio Blogs API is the backend engine for the Gaprio blogging platform. It is built with **Express.js v5**, uses **Prisma ORM** to interact with a **MySQL** database, and follows a **Modular Monolith** architecture where each domain feature (auth, posts, users, etc.) is self-contained inside its own module folder.

**What does this API do?**

- Lets users **register**, **log in**, and **manage their sessions** with JWT-based authentication.
- Allows writers and authors to **create**, **edit**, **publish**, and **delete** blog posts.
- Enables readers to **comment**, **like**, and **bookmark** posts.
- Provides admins with full control to **manage users**, **moderate content**, and **organize taxonomy** (categories and tags).
- Integrates with **Cloudflare R2** (S3-compatible) for scalable media/image storage using pre-signed URLs.
- Sends transactional emails (verification codes, password resets) via the **Resend** email service.

---

## Features

### 🔐 Authentication & Sessions
- **Email + Password registration** with auto-login on signup
- **Email verification** using OTP (6-digit code sent via email)
- **JWT access tokens** (short-lived, 15 minutes by default) + **refresh tokens** (long-lived, 7 days)
- **Session tracking** — stores IP address, user-agent, and device ID per session
- **Password recovery** — forgot-password and reset-password flow with OTP verification
- **Token rotation** — old refresh tokens are destroyed and replaced on every refresh

### 📝 Blog Post Management
- Full **CRUD** (Create, Read, Update, Delete) for blog posts
- **Rich text content** support with automatic read-time calculation
- **SEO fields** — `metaTitle`, `metaDescription`, `canonicalUrl` on every post
- **Slug-based routing** with auto-generated, URL-safe slugs (collision-resistant)
- **Cover image uploads** via Cloudflare R2 pre-signed URLs
- **Post statuses** — `DRAFT`, `PUBLISHED`, `ARCHIVED`
- **Advanced filtering** — search by title/content, filter by category, tag, or author
- **Pagination** — cursor-based with `page`, `limit`, `total`, and `totalPages` metadata
- **View count tracking** — atomic, fire-and-forget increment on each page view

### 🏷️ Taxonomy (Categories & Tags)
- **Categories** — hierarchical content organization with slugs and descriptions
- **Tags** — flat, many-to-many relationship with posts for flexible labeling
- **Admin-only** creation, update, and deletion

### 💬 User Interactions
- **Comments** — threaded/nested replies via self-referencing `parentId`
- **Likes** — toggle-based (like/unlike) with unique constraint per user-post pair
- **Bookmarks** — toggle-based (save/unsave) with unique constraint per user-post pair
- **Admin moderation** — hide/approve comments

### 👥 User Management
- **Public author profiles** — viewable by anyone
- **Self-service profile management** — update name, image, phone; change password; delete account
- **Admin controls** — list all users, change user roles, ban/unban users, force-delete accounts

### 🛡️ Security
- **Helmet** — sets secure HTTP headers automatically
- **CORS** — configurable allowed origins with credentials support
- **Rate limiting** — 200 requests per 15-minute window per IP (production only)
- **Zod validation** — every incoming request body, query, and param is validated before reaching controllers
- **bcrypt password hashing** — salted with 12 rounds
- **Centralized error handling** — dev mode shows stack traces, production hides internals

### ☁️ Cloud Storage
- **Cloudflare R2** integration via the AWS S3 SDK (S3-compatible)
- **Pre-signed URL uploads** — the frontend uploads directly to R2, reducing server load
- **Automatic cleanup** — old cover images are deleted from R2 when replaced or when a post is deleted

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | [Node.js](https://nodejs.org/) | JavaScript runtime environment |
| **Framework** | [Express.js v5](https://expressjs.com/) | HTTP server and routing |
| **Database** | [MySQL](https://www.mysql.com/) | Relational data storage |
| **ORM** | [Prisma](https://www.prisma.io/) | Type-safe database queries and schema management |
| **Validation** | [Zod](https://zod.dev/) | Schema declaration and request validation |
| **Auth** | [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) | JWT generation and verification |
| **Hashing** | [bcrypt](https://github.com/kelektiv/node.bcrypt.js) | Secure password hashing |
| **Email** | [Resend](https://resend.com/) | Transactional email delivery |
| **Storage** | [AWS S3 SDK](https://docs.aws.amazon.com/sdk-for-javascript/) → [Cloudflare R2](https://developers.cloudflare.com/r2/) | S3-compatible object storage for media |
| **Security** | [Helmet](https://helmetjs.github.io/) + [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) | HTTP header security and brute-force protection |
| **CORS** | [cors](https://github.com/expressjs/cors) | Cross-Origin Resource Sharing |
| **Dev Tooling** | [Nodemon](https://nodemon.io/) | Auto-restart server on file changes |

---

## Architecture

The codebase follows a **Modular Monolith** pattern with an **MVC-inspired** (Model-View-Controller) structure adapted for a REST API. Instead of grouping all controllers or all services together, the code is organized by **feature domain**.

### Request Lifecycle

Here is the journey of every API request, from arrival to response:

```
Client Request
     │
     ▼
┌─────────────────────────────────┐
│  Global Middlewares             │
│  (Helmet → CORS → Rate Limit   │
│   → Body Parser → Cookie Parser)│
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│  Router (routes/index.js)       │
│  Routes request to correct      │
│  module based on URL path       │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│  Validation Middleware          │
│  Zod schema validates body,     │
│  query params, and URL params   │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│  Auth Guards (if protected)     │
│  protect → verifies JWT         │
│  restrictTo → checks user role  │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│  Controller                     │
│  Extracts data from req,        │
│  calls Service, sends response  │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│  Service                        │
│  Business logic + database      │
│  operations via Prisma ORM      │
└───────────────┬─────────────────┘
                │
                ▼
         JSON Response
```

### Key Architectural Decisions

- **Service Layer Pattern** — Controllers never touch the database. They delegate all business logic to Service classes, keeping HTTP concerns separate from data logic.
- **Validation Pipeline** — A `validate` middleware wraps Zod schemas and rejects malformed input with structured error messages (`400 Bad Request`) before the controller is ever called.
- **Centralized Error Handling** — A global `errorHandler` middleware catches all errors. In development, it returns full stack traces. In production, it hides internals and returns user-safe messages.
- **Graceful Shutdown** — `server.js` listens for `SIGTERM` and `SIGINT` signals to cleanly close the HTTP server and disconnect Prisma before the process exits.

---

## Project Structure

```
gaprio-blogs-api/
│
├── .env.example              # Template for required environment variables
├── .gitignore                # Files excluded from version control
├── package.json              # Dependencies, scripts, and project metadata
├── prisma.config.ts          # Prisma CLI configuration (schema path, migrations)
├── DEVELOPER_DOCS.md         # Internal developer reference documentation
│
├── prisma/
│   └── schema.prisma         # Database schema — tables, relations, enums
│
└── src/
    ├── app.js                # Express app setup — middlewares, routes, error handling
    ├── server.js             # Entry point — starts server, connects DB, handles shutdown
    │
    ├── config/               # Application configuration
    │   ├── db.js             # Prisma client singleton (prevents connection leaks in dev)
    │   ├── env.js            # Zod-validated environment variables (fails fast if misconfigured)
    │   └── mail.js           # Resend SDK setup + reusable sendEmail() function
    │
    ├── middlewares/           # Global Express middlewares
    │   ├── auth.middleware.js   # protect (JWT verification) + restrictTo (role-based access)
    │   ├── error.middleware.js  # Centralized error handler (Prisma errors, operational errors)
    │   └── validate.middleware.js # Zod schema validation for req.body, query, params
    │
    ├── modules/              # Feature-based domain modules
    │   ├── auth/             # Registration, login, email verification, password recovery
    │   │   ├── auth.routes.js
    │   │   ├── auth.controller.js
    │   │   ├── auth.service.js
    │   │   └── auth.validation.js
    │   │
    │   ├── category/         # Categories and Tags (taxonomy)
    │   │   ├── category.routes.js
    │   │   ├── category.controller.js
    │   │   ├── category.service.js
    │   │   └── category.validation.js
    │   │
    │   ├── interaction/      # Comments, Likes, Bookmarks
    │   │   ├── interaction.routes.js
    │   │   ├── interaction.controller.js
    │   │   ├── interaction.service.js
    │   │   └── interaction.validation.js
    │   │
    │   ├── post/             # Blog post CRUD + admin controls
    │   │   ├── post.routes.js
    │   │   ├── post.controller.js
    │   │   ├── post.service.js
    │   │   └── post.validation.js
    │   │
    │   └── user/             # User profiles + admin user management
    │       ├── user.routes.js
    │       ├── user.controller.js
    │       ├── user.service.js
    │       └── user.validation.js
    │
    ├── routes/
    │   └── index.js          # Master API router — mounts all module routes under /api/v1
    │
    └── utils/                # Shared utility functions
        ├── ApiResponse.js    # Standardized JSON response class (status, message, data, meta)
        ├── AppError.js       # Custom error class with statusCode and isOperational flag
        ├── catchAsync.js     # Wrapper to eliminate try-catch in async controller functions
        ├── r2.storage.js     # Cloudflare R2 integration (pre-signed upload URLs, delete)
        └── tokens.js         # JWT access token, refresh token, OTP, and hash generation
```

### Module Pattern

Every module inside `src/modules/` follows the same 4-file structure:

| File | Responsibility |
|------|---------------|
| `*.routes.js` | Defines HTTP routes, applies validation and auth middlewares |
| `*.controller.js` | Handles the HTTP layer — extracts data from `req`, calls the service, sends `res` |
| `*.service.js` | Contains all business logic and database queries (Prisma) |
| `*.validation.js` | Exports Zod schemas that validate request body, query, and params |

**Example flow for creating a post:**

```
POST /api/v1/posts
  → validate(createPostSchema)       ← Zod checks title, content, etc.
  → protect                          ← Verifies JWT, attaches req.user
  → restrictTo('WRITER','AUTHOR','ADMIN')  ← Checks role
  → PostController.createPost        ← Extracts req.body, calls service
  → PostService.createPost           ← Generates slug, calculates read time, inserts into DB
  → 201 JSON Response                ← Returns the new post object
```

---

## Prerequisites

Before you begin, make sure you have the following installed on your machine:

- **[Node.js](https://nodejs.org/)** — v18 or higher (LTS recommended)
- **[npm](https://www.npmjs.com/)** — comes bundled with Node.js
- **[MySQL](https://www.mysql.com/)** — v8.0+ (or use a cloud-hosted MySQL like PlanetScale or Aiven)
- **[Git](https://git-scm.com/)** — for cloning the repository

**Optional but recommended:**
- **[Postman](https://www.postman.com/)** or **[Insomnia](https://insomnia.rest/)** — for testing API endpoints
- **[Prisma Studio](https://www.prisma.io/studio)** — built-in visual database browser (included via `npm run db:studio`)

---

## Installation

### 1. Clone the repository

```bash
# Using HTTPS
git clone https://github.com/gaprio-labs/blogs-api.git

# Navigate into the project folder
cd blogs-api
```

### 2. Install dependencies

```bash
npm install
```

This installs all production and development dependencies listed in `package.json`, including Express, Prisma, Zod, bcrypt, and more.

### 3. Set up environment variables

```bash
# Copy the example environment file
cp .env.example .env
```

Now open the `.env` file and fill in your actual credentials. See the [Environment Variables](#environment-variables) section below for a detailed explanation of each variable.

### 4. Set up the database

Make sure your MySQL server is running, then:

```bash
# Generate the Prisma Client (creates the query builder based on your schema)
npm run db:generate

# Push the schema to your MySQL database (creates all tables)
npm run db:push
```

> **What's the difference?**
> - `db:generate` — reads `prisma/schema.prisma` and generates the JavaScript client library you import in code (`@prisma/client`).
> - `db:push` — reads the schema and creates/updates the actual MySQL tables to match. This is great for development; for production, use `prisma migrate` instead.

### 5. (Optional) Browse your database visually

```bash
npm run db:studio
```

This opens **Prisma Studio** in your browser — a visual interface where you can view, create, edit, and delete records in your database without writing SQL.

---

## Environment Variables

Create a `.env` file in the project root. Every variable listed below is **required** — the server will refuse to start if any are missing or invalid (validated by Zod at boot time in `src/config/env.js`).

```env
# ==========================================
# DATABASE
# ==========================================
# Format: mysql://USER:PASSWORD@HOST:PORT/DATABASE_NAME
DATABASE_URL="mysql://root:your_password@localhost:3306/gaprio_blogs"

# ==========================================
# SERVER
# ==========================================
PORT=8000
NODE_ENV="development"       # "development" | "production" | "test"

# ==========================================
# JWT AUTHENTICATION
# ==========================================
JWT_SECRET="super_secret_gaprio_jwt_key_that_is_at_least_32_chars_long!"   # Must be ≥ 32 characters
JWT_EXPIRES_IN="15m"         # Access token lifespan (e.g., "15m", "1h", "7d")

# ==========================================
# EMAIL (Resend)
# ==========================================
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"    # Must start with "re_"
FROM_EMAIL="hello@yourdomain.com"                         # Must be a valid email

# ==========================================
# CLOUDFLARE R2 STORAGE
# ==========================================
CLOUDFLARE_ACCOUNT_ID="your_account_id"
CLOUDFLARE_ACCESS_KEY="your_access_key"
CLOUDFLARE_SECRET_KEY="your_secret_key"
CLOUDFLARE_BUCKET_NAME="your_bucket_name"
CLOUDFLARE_PUBLIC_DOMAIN="https://pub-xxxx.r2.dev"        # Must be a valid URL
```

### Variable Reference

| Variable | Type | Description |
|----------|------|-------------|
| `DATABASE_URL` | `string` | MySQL connection string. Example: `mysql://root:password@localhost:3306/gaprio_blogs` |
| `PORT` | `string` | Port number the server listens on. Defaults to `8000` |
| `NODE_ENV` | `enum` | `"development"`, `"production"`, or `"test"`. Controls error verbosity, rate limiting, and logging |
| `JWT_SECRET` | `string` | Secret key used to sign JWTs. **Must be at least 32 characters**. Keep this extremely secure |
| `JWT_EXPIRES_IN` | `string` | How long an access token stays valid. Uses `ms`-compatible format (`"15m"`, `"1h"`, `"7d"`) |
| `RESEND_API_KEY` | `string` | Your API key from [resend.com](https://resend.com). Must start with `"re_"` |
| `FROM_EMAIL` | `string` | The "from" address for outbound emails (e.g., `hello@gaprio.com`) |
| `CLOUDFLARE_ACCOUNT_ID` | `string` | Your Cloudflare account ID (found in the Cloudflare dashboard) |
| `CLOUDFLARE_ACCESS_KEY` | `string` | R2 API access key (generate in Cloudflare R2 settings) |
| `CLOUDFLARE_SECRET_KEY` | `string` | R2 API secret key (paired with access key) |
| `CLOUDFLARE_BUCKET_NAME` | `string` | Name of the R2 bucket where media files are stored |
| `CLOUDFLARE_PUBLIC_DOMAIN` | `string` | Public URL for accessing uploaded objects (e.g., `https://pub-xxxx.r2.dev`) |

> ⚠️ **Important:** The `.env` file is listed in `.gitignore` and should **never** be committed to version control. If you add a new environment variable, always update `.env.example` as well.

---

## Running Locally

### Development mode (with auto-restart)

```bash
npm run dev
```

This starts the server using **Nodemon**, which watches for file changes and automatically restarts the server. You should see output like:

```
📦 Database connection layer initialized successfully.
🚀 Gaprio API Engine is running in [development] mode on port 8000
```

### Production mode

```bash
npm start
```

This runs `node src/server.js` directly without Nodemon.

### Available npm scripts

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `nodemon src/server.js` | Start the dev server with hot-reload |
| `npm start` | `node src/server.js` | Start the production server |
| `npm run db:generate` | `prisma generate` | Regenerate the Prisma Client after schema changes |
| `npm run db:push` | `prisma db push` | Sync your Prisma schema to the MySQL database |
| `npm run db:studio` | `prisma studio` | Open the Prisma visual database browser |

### Verifying the server is running

Once the server starts, you can test these endpoints:

```bash
# Root endpoint — returns API info
curl http://localhost:8000/

# Health check — used by monitoring tools and load balancers
curl http://localhost:8000/health
```

**Expected response from `/`:**

```json
{
  "success": true,
  "message": "Welcome to the Gaprio Blogs API Engine 🚀",
  "version": "1.0.0",
  "environment": "development",
  "healthCheck": "Visit /health for server operational status",
  "mainAPI": "Visit /api/v1 for accessible application endpoints"
}
```

---

## API Endpoints

**Base URL:** `http://localhost:8000/api/v1`

All endpoints are prefixed with `/api/v1`. Protected routes require a valid JWT in the `Authorization` header:

```
Authorization: Bearer <your_access_token>
```

Access levels explained:
- **🌐 Public** — No authentication required
- **🔒 Protected** — Requires a valid JWT (any logged-in user)
- **✍️ Writer+** — Requires `WRITER`, `AUTHOR`, or `ADMIN` role
- **🛡️ Admin** — Requires `ADMIN` role only

---

### Authentication (`/auth`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `POST` | `/auth/register` | 🌐 Public | Register a new account. Sends OTP to email. Returns access + refresh tokens (auto-login). |
| `POST` | `/auth/verify-email` | 🌐 Public | Verify email with the 6-digit OTP. |
| `POST` | `/auth/resend-verification` | 🌐 Public | Resend the email verification OTP. |
| `POST` | `/auth/login` | 🌐 Public | Log in with email + password. Returns access + refresh tokens. |
| `POST` | `/auth/refresh` | 🌐 Public | Exchange a valid refresh token for new access + refresh tokens. |
| `POST` | `/auth/logout` | 🌐 Public | Invalidate the refresh token (destroys the session). |
| `POST` | `/auth/forgot-password` | 🌐 Public | Send a password reset OTP to the user's email. |
| `POST` | `/auth/reset-password` | 🌐 Public | Reset password using email + OTP + new password. |

**Example — Register a new user:**

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "SecurePass123"
  }'
```

**Example response:**

```json
{
  "success": true,
  "status": "success",
  "message": "Registration successful. You are now logged in. Please check your email for the verification code.",
  "data": {
    "user": {
      "id": "cm5abc...",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "USER"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "a1b2c3d4e5f6..."
  }
}
```

---

### Users (`/users`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/users/:id/public` | 🌐 Public | Get a user's public profile (name, image, role). |
| `GET` | `/users/me` | 🔒 Protected | Get the currently logged-in user's full profile. |
| `PATCH` | `/users/me` | 🔒 Protected | Update your own profile (name, image, phone). |
| `PATCH` | `/users/me/password` | 🔒 Protected | Change your password (requires current password). |
| `DELETE` | `/users/me` | 🔒 Protected | Permanently delete your own account. |
| `GET` | `/users/` | 🛡️ Admin | List all users in the system. |
| `PATCH` | `/users/:id/role` | 🛡️ Admin | Change a user's role (USER, WRITER, AUTHOR, ADMIN). |
| `PATCH` | `/users/:id/ban` | 🛡️ Admin | Toggle ban status on a user. |
| `DELETE` | `/users/:id` | 🛡️ Admin | Permanently delete any user. |

---

### Blog Posts (`/posts`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/posts` | 🌐 Public | Get all published posts. Supports filtering and pagination (see below). |
| `GET` | `/posts/:slug` | 🌐 Public | Get a single published post by its URL slug. Auto-increments view count. |
| `GET` | `/posts/me` | ✍️ Writer+ | Get all posts written by the current user (drafts, published, archived). |
| `POST` | `/posts` | ✍️ Writer+ | Create a new post (defaults to DRAFT status). |
| `PATCH` | `/posts/:id` | ✍️ Writer+ | Update your own post. Handles slug regeneration and R2 image cleanup. |
| `DELETE` | `/posts/:id` | ✍️ Writer+ | Delete your own post. Cleans up cover image from Cloudflare R2. |
| `GET` | `/posts/admin/all` | 🛡️ Admin | Get all posts regardless of status. |
| `PATCH` | `/posts/admin/:id/status` | 🛡️ Admin | Force-update any post's status (DRAFT/PUBLISHED/ARCHIVED). |
| `DELETE` | `/posts/admin/:id/force` | 🛡️ Admin | Force-delete any post. |

**Query parameters for `GET /posts`:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `number` | `1` | Page number for pagination |
| `limit` | `number` | `10` | Number of posts per page |
| `search` | `string` | — | Search posts by title or content |
| `categoryId` | `string` | — | Filter by category ID |
| `tagSlug` | `string` | — | Filter by tag slug |
| `authorId` | `string` | — | Filter by author ID |

**Example — Fetch page 2 of published posts about "javascript":**

```bash
curl "http://localhost:8000/api/v1/posts?page=2&limit=5&search=javascript"
```

---

### Categories & Tags (`/categories`, `/tags`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/categories` | 🌐 Public | Get all categories. |
| `GET` | `/categories/:slug` | 🌐 Public | Get a single category by its slug. |
| `POST` | `/categories` | 🛡️ Admin | Create a new category. |
| `PATCH` | `/categories/:id` | 🛡️ Admin | Update a category's name, slug, or description. |
| `DELETE` | `/categories/:id` | 🛡️ Admin | Delete a category. |
| `GET` | `/tags` | 🌐 Public | Get all tags. |
| `POST` | `/tags` | 🛡️ Admin | Create a new tag. |
| `PATCH` | `/tags/:id` | 🛡️ Admin | Update a tag's name or slug. |
| `DELETE` | `/tags/:id` | 🛡️ Admin | Delete a tag. |

---

### Interactions (`/posts/:postId`, `/comments`)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| `GET` | `/posts/:postId/comments` | 🌐 Public | Get all approved comments for a post. |
| `POST` | `/posts/:postId/comments` | 🔒 Protected | Add a comment (supports nested replies via `parentId`). |
| `POST` | `/posts/:postId/like` | 🔒 Protected | Toggle like on a post (like/unlike). |
| `POST` | `/posts/:postId/bookmark` | 🔒 Protected | Toggle bookmark on a post (save/unsave). |
| `PATCH` | `/comments/:id` | 🔒 Protected | Edit your own comment. |
| `DELETE` | `/comments/:id` | 🔒 Protected | Delete your own comment. |
| `PATCH` | `/comments/:id/moderate` | 🛡️ Admin | Moderate a comment (approve/hide). |

---

## Security

This API implements multiple layers of security:

### 1. Input Validation (Zod)

Every single request is validated against a Zod schema **before** it reaches the controller. This prevents:
- Missing required fields
- Invalid data types (e.g., passing a number where a string is expected)
- SQL injection via malformed input
- Passwords that don't meet complexity requirements

```javascript
// Example: Registration schema enforces strict rules
export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(50).trim(),
    email: z.string().email().toLowerCase().trim(),
    password: z.string()
      .min(8)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/,
        'Must contain uppercase, lowercase, and a number'),
  }),
});
```

### 2. Authentication (JWT + Sessions)

- Access tokens are signed with **HS256** and expire in **15 minutes** by default.
- Refresh tokens are **64-byte cryptographically random** hex strings, **SHA-256 hashed** before storage.
- On every refresh, the old session is destroyed and a new one is created (**token rotation**).
- The `protect` middleware verifies the JWT, checks if the user still exists, and checks if they are banned.

### 3. Role-Based Access Control (RBAC)

The database defines four roles via a Prisma `enum`:

| Role | Permissions |
|------|------------|
| `USER` | Read posts, comment, like, bookmark |
| `WRITER` | All USER permissions + create/edit draft posts |
| `AUTHOR` | All WRITER permissions + publish posts |
| `ADMIN` | Full system control — manage users, moderate content, force-delete |

The `restrictTo(...roles)` middleware enforces these restrictions:

```javascript
// Only ADMIN can access this route
router.delete('/users/:id', protect, restrictTo('ADMIN'), UserController.adminDeleteUser);
```

### 4. HTTP Security Headers (Helmet)

Helmet automatically sets headers like:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (HSTS)
- And more...

### 5. Rate Limiting

In production mode, all `/api` routes are rate-limited to **200 requests per 15-minute window** per IP address using `express-rate-limit`.

### 6. CORS

Configurable allowed origins — only trusted frontend domains can make requests:

```javascript
const allowedOrigins = [
  env.NODE_ENV === 'production' ? 'https://gaprio.com' : 'http://localhost:3000',
  'http://localhost:5173',    // Vite dev server
  'http://localhost:5500',    // Live Server
];
```

---

## Database Schema

The database uses **MySQL** and is managed by **Prisma ORM**. Here is a visual overview of the data model:

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    User      │       │   Session    │       │   Account    │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (CUID)    │──┐    │ id (CUID)    │       │ id (CUID)    │
│ name         │  ├───→│ userId   (FK)│       │ userId   (FK)│
│ email (UQ)   │  │    │ expiresAt    │       │ providerId   │
│ emailVerified│  │    │ ipAddress    │       │ password     │
│ image        │  │    │ userAgent    │       │ accessToken  │
│ phoneNumber  │  │    │ deviceId     │       │ refreshToken │
│ role (ENUM)  │  │    └──────────────┘       └──────────────┘
│ isBanned     │  │
│ createdAt    │  │    ┌──────────────┐       ┌──────────────┐
│ updatedAt    │  ├───→│    Post      │       │   Category   │
└──────────────┘  │    ├──────────────┤       ├──────────────┤
                  │    │ id (CUID)    │    ┌──│ id (CUID)    │
                  │    │ title        │    │  │ name (UQ)    │
                  │    │ slug (UQ)    │    │  │ slug (UQ)    │
                  │    │ content      │    │  │ description  │
                  │    │ excerpt      │    │  └──────────────┘
                  │    │ coverImage   │    │
                  │    │ status (ENUM)│    │  ┌──────────────┐
                  │    │ readTime     │    │  │     Tag      │
                  │    │ viewCount    │    │  ├──────────────┤
                  │    │ likeCount    │    │  │ id (CUID)    │
                  │    │ shareCount   │    │  │ name (UQ)    │
                  │    │ metaTitle    │    │  │ slug (UQ)    │
                  │    │ authorId (FK)│←───┘  └──────┬───────┘
                  │    │ categoryId(FK)│              │
                  │    │ tags (M2M)   │←─────────────┘
                  │    └──────┬───────┘
                  │           │
         ┌────────┴─────┐    │    ┌──────────────┐
         │   Comment    │    │    │     Like     │
         ├──────────────┤    │    ├──────────────┤
         │ id (CUID)    │    │    │ id (CUID)    │
         │ content      │    ├───→│ userId   (FK)│
         │ isApproved   │    │    │ postId   (FK)│
         │ userId   (FK)│    │    │ (UQ: user+post)│
         │ postId   (FK)│←───┘    └──────────────┘
         │ parentId (FK)│←─┐
         │ replies      │──┘     ┌──────────────┐
         └──────────────┘        │   Bookmark   │
                                 ├──────────────┤
                                 │ id (CUID)    │
                                 │ userId   (FK)│
                                 │ postId   (FK)│
                                 │ (UQ: user+post)│
                                 └──────────────┘
```

**Key schema features:**
- **CUIDs** are used for all primary keys (collision-resistant unique IDs)
- **Cascading deletes** — deleting a user removes all their sessions, accounts, posts, comments, likes, and bookmarks
- **Unique constraints** on `Like(userId, postId)` and `Bookmark(userId, postId)` prevent duplicate interactions
- **Self-referencing relation** on `Comment` enables threaded/nested replies
- **Database indexes** on frequently queried columns (`authorId`, `categoryId`, `slug`, `status+createdAt`)

---

## Deployment

This API is designed to be deployed on any Node.js-compatible cloud platform. Here are general steps:

### General Deployment Steps

1. **Provision a MySQL database** — Use a managed service like [PlanetScale](https://planetscale.com/), [Aiven](https://aiven.io/), [AWS RDS](https://aws.amazon.com/rds/), or [Railway](https://railway.app/).

2. **Set environment variables** — Configure all variables from the [Environment Variables](#environment-variables) section in your platform's dashboard. Make sure `NODE_ENV` is set to `"production"`.

3. **Set the build/start command:**
   ```bash
   # Install dependencies and generate Prisma Client
   npm install && npm run db:generate

   # Push schema (first deploy only — use migrations for subsequent deploys)
   npm run db:push

   # Start the server
   npm start
   ```

4. **Ensure `trust proxy` is configured** — The API already sets `app.set('trust proxy', 1)` in `app.js`, which is required for `express-rate-limit` to correctly identify client IPs behind reverse proxies (Render, Railway, AWS ALB, etc.).

5. **Set up Cloudflare R2** — Create an R2 bucket, generate API tokens, and configure the `CLOUDFLARE_*` environment variables.

### Platform-Specific Notes

| Platform | Start Command | Notes |
|----------|--------------|-------|
| **[Render](https://render.com/)** | `npm start` | Add a build command: `npm install && npm run db:generate && npm run db:push`. Use Render's health check with `/health`. |
| **[Railway](https://railway.app/)** | Auto-detected | Railway auto-detects `npm start`. Add MySQL as a plugin. Set env vars in the dashboard. |
| **[Fly.io](https://fly.io/)** | `npm start` | Use `fly launch` to generate a Dockerfile. Set env vars with `fly secrets set`. |
| **[AWS (EC2/ECS)](https://aws.amazon.com/)** | `npm start` | Use PM2 or Docker for process management. Set up an ALB for load balancing. |

### Health Check

The API exposes a dedicated health check endpoint for monitoring and load balancer probes:

```
GET /health
```

Response:
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-06-14T00:00:00.000Z",
  "message": "Gaprio API core services are fully operational."
}
```

---

## Contributing

We welcome contributions from the community! Whether you're fixing a bug, adding a feature, or improving documentation — every contribution matters.

### Getting Started

1. **Fork** the [upstream repository](https://github.com/gaprio-labs/blogs-api) on GitHub.

2. **Clone** your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/blogs-api.git
   cd blogs-api
   ```

3. **Set up the upstream remote** (to stay in sync with the main repo):
   ```bash
   git remote add upstream https://github.com/gaprio-labs/blogs-api.git
   ```

4. **Install and configure** — follow the [Installation](#installation) steps above.

5. **Create a feature branch** (never work directly on `main`):
   ```bash
   git checkout -b feature/add-user-bookmarks
   ```
   Use prefixes like `feature/`, `bugfix/`, `hotfix/`, or `docs/`.

6. **Make your changes** and test locally:
   ```bash
   npm run dev
   ```

7. **Commit** with a clear, descriptive message:
   ```bash
   git add .
   git commit -m "feat: add bookmark toggle endpoint in interaction module"
   ```

8. **Push** to your fork:
   ```bash
   git push origin feature/add-user-bookmarks
   ```

9. **Open a Pull Request** on GitHub — provide a clear title, describe your changes, and link any related issues.

### Coding Standards

| Rule | Details |
|------|---------|
| **Module structure** | All new features go inside `src/modules/`. Follow the 4-file pattern: `routes.js`, `controller.js`, `service.js`, `validation.js`. |
| **Validation is mandatory** | Every `POST`, `PATCH`, and `PUT` route must have a Zod schema passed through the `validate` middleware. |
| **Use `catchAsync`** | Never use raw `try/catch` in controllers. Wrap all async controller methods with the `catchAsync` utility. |
| **Never commit `.env`** | If you add a new environment variable, add it to `.env.example` with a placeholder value. |
| **Service layer** | Controllers must not contain database logic. Delegate to the Service layer. |
| **Error handling** | Use `AppError` for all operational errors (e.g., `throw new AppError('Not found', 404)`). |

### Commit Message Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add user bookmark functionality
fix: resolve JWT expiration check edge case
docs: update README with deployment instructions
refactor: extract slug generation into utility
```

---

## License

This project is licensed under the **ISC License**.

```
ISC License

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

---

<p align="center">
  Built with ❤️ by the <a href="https://github.com/gaprio-labs">Gaprio Labs</a> team
</p>
