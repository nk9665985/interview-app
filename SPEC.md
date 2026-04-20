# Interview App - Technical Specification

## Project Overview
- **Project Name**: Interview Preparation App
- **Type**: Full-stack Web Application
- **Core Functionality**: Mock interview test platform with AI-generated questions, user authentication, and admin panel
- **Target Users**: Job seekers preparing for interviews, Admin/HR personnel

## Technology Stack
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT (JSON Web Tokens)

## UI/UX Specification

### Color Palette
- **Primary**: #1a1a2e (Deep Navy)
- **Secondary**: #16213e (Dark Blue)
- **Accent**: #e94560 (Coral Red)
- **Success**: #00d9a5 (Mint Green)
- **Background**: #0f0f23 (Dark Background)
- **Text Primary**: #ffffff
- **Text Secondary**: #a0a0b0

### Typography
- **Headings**: 'Outfit', sans-serif (Google Fonts)
- **Body**: 'DM Sans', sans-serif (Google Fonts)
- **Sizes**: H1: 2.5rem, H2: 2rem, H3: 1.5rem, Body: 1rem

### Layout Structure
- **Login Page**: Centered card with form, animated background
- **User Dashboard**: Sidebar navigation + main content area
- **Test Interface**: Full-screen focused test view with timer
- **Admin Panel**: Data tables with filters and actions

### Components
1. **Login/Register Form**
   - Email input with validation
   - Password input with show/hide toggle
   - Role selector (User/Admin)
   - Animated submit button

2. **User Dashboard**
   - Profile card with stats
   - Start Test button
   - Previous scores history
   - Progress indicators

3. **Mock Test Interface**
   - Question display with options
   - Timer countdown
   - Progress bar
   - Navigation between questions
   - Submit test button

4. **Admin Panel**
   - User management table
   - Score analytics
   - Question bank management
   - AI Question Generator

## Database Schema

### Users Table
```
sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Questions Table
```
sql
CREATE TABLE questions (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer INTEGER NOT NULL,
  difficulty VARCHAR(20) DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Results Table
```
sql
CREATE TABLE results (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  time_taken INTEGER NOT NULL,
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Functionality Specification

### Authentication
- User registration with email validation
- Login with email/password
- JWT-based session management
- Role-based access control (user/admin)

### Mock Test Features
- Category selection (Technical, HR, Aptitude)
- Random question selection
- Timer for each test (30 minutes)
- Auto-submit on timeout
- Immediate score display
- Detailed results review

### AI Question Generation
- OpenAI API integration for generating questions
- Category-based question generation
- Difficulty level selection
- Bulk question creation

### Admin Panel Features
- View all registered users
- View all test results
- Search and filter users
- Generate AI questions
- Delete/modify questions

## API Endpoints

### Auth Routes
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me

### Question Routes
- GET /api/questions (with filters)
- POST /api/questions (admin)
- POST /api/questions/generate-ai (admin)
- DELETE /api/questions/:id (admin)

### Result Routes
- POST /api/results (submit test)
- GET /api/results/user/:userId (user's results)
- GET /api/results/all (admin)

### User Routes
- GET /api/users (admin)
- DELETE /api/users/:id (admin)

## Acceptance Criteria
1. ✓ User can register and login
2. ✓ User can take mock tests with timer
3. ✓ User can see their test history and scores
4. ✓ Admin can view all users and their information
5. ✓ Admin can generate AI questions
6. ✓ Responsive design works on all devices
7. ✓ Secure authentication with JWT
