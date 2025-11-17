# CV Evaluation System

An intelligent automated CV evaluation system built with NestJS that analyzes candidate CVs and project reports against job requirements using AI-powered evaluation.

## Overview

The CV Evaluation System is a comprehensive API service designed to automate the candidate evaluation process. It leverages AI models to assess CVs and project reports against job descriptions and rubrics, providing detailed feedback and scoring.

### Key Features

- **User Authentication**: Secure JWT-based authentication with user registration and login
- **Document Upload**: Support for CV and project report uploads (PDF format)
- **File Management**: Users can view their uploaded documents
- **AI-Powered Evaluation**:
  - CV matching against job descriptions
  - Project report assessment based on case studies
  - Overall candidate scoring and feedback
- **System Document Management**: Internal document storage for job descriptions, rubrics, and case studies
- **Queue-Based Processing**: Background job processing using BullMQ for scalable evaluations
- **Cloud Storage**: S3-compatible storage integration for document management
- **RAG Integration**: Ragie API integration for intelligent document retrieval

## Prerequisites

Before setting up the application, ensure you have the following installed:

- Node.js (v18 or higher)
- pnpm (v8 or higher)
- PostgreSQL (v14 or higher)
- Redis (v6 or higher)
- S3-compatible storage (AWS S3, Supabase Storage, MinIO, etc.)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd cv-evaluation
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Configuration**

   Copy the example environment file and configure it:
   ```bash
   cp .env.example .env
   ```

   Update the `.env` file with your configuration:

4. **Database Setup**

   Generate Prisma client and run migrations:
   ```bash
   pnpm prisma generate
   pnpm prisma migrate deploy
   ```

   Or for development with migration creation:
   ```bash
   pnpm prisma migrate dev
   ```

## Running the Application

### Development Mode
```bash
pnpm run start:dev
```

### Production Mode
```bash
# Build the application
pnpm run build

# Run in production
pnpm run start:prod
```

## API Documentation

Once the application is running, access the interactive API documentation:
- Swagger UI: `http://localhost:3000/docs`

### Main Endpoints

#### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh access token

#### File Management
- `POST /upload` - Upload CV and project report
- `GET /files` - Get list of uploaded files

#### Evaluation
- `POST /evaluate` - Start candidate evaluation
- `GET /result/:id` - Get evaluation result

#### System Documents (Internal API)
- `POST /system-docs` - Upload system documents (requires API key)
