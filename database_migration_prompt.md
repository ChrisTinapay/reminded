# Context
You are an expert full-stack developer working with a Next.js (App Router) codebase. We are planning a significant database and storage migration for our application.

Currently, the application relies entirely on Supabase for Backend-as-a-Service, which handles:
1.  **Authentication:** Google OAuth via Supabase Auth.
2.  **Relational Database:** Storing user profiles, courses, questions, etc.
3.  **Storage:** Storing uploaded PDF course materials.

## The Architectural Revision
We recently undertook a major architectural revision on the frontend. Previously, the app had distinct `educator` and `student` roles. **We have now removed the educator role entirely.** 

The system is now "student-sided only." Every user signs in as a student by default. However, any student inherently possesses the ability to:
- Create courses.
- Upload PDF materials to those courses.
- Generate questions from those materials (via a Gemini API integration in our backend).
- Manage a question bank for their created courses.
- Review their own enrolled courses.

## The Goal
We want to decouple our backend architecture:
1.  **Keep Supabase ONLY for Authentication.**
2.  **Migrate all Relational Database functionality to Turbo (or another designated database platform).**
3.  **Migrate Storage (PDF uploads) to another designated storage platform.**

## The Current Issue
Because we just merged the heavy course-creator features into the student frontend, our frontend logic for saving/fetching relational data—specifically saving generated `questions`, reading `courses`, and updating `profiles`—is somewhat broken or out-of-sync with the current Supabase database rules and constraints. 

Since we are planning to migrate away from Supabase for relational data anyway, we do not want to fix the Supabase database. Instead, we want your help setting up the new platforms and rewriting our data-fetching and data-mutating logic.

## Current Data Schema Breakdown (To be migrated)
Here are the tables we currently use in Supabase that need to be migrated to the new database platform:

1.  **`profiles`**: Links to the Supabase Auth User ID. Stores `full_name`, `email`, `role` (now legacy, everyone is a student), `academic_level_id`, and `program_id`.
2.  **`courses`**: Stores `course_name`, `educator_id` (the ID of the student who created it), `academic_level_id`, and `program_id`.
3.  **`academic_levels`**: Look-up table for levels (id, name).
4.  **`programs`**: Look-up table for programs/majors (id, name).
5.  **`learning_materials`**: Stores `course_id`, `file_name`, and `file_path` (points to uploaded PDFs).
6.  **`questions`**: Stores `course_id`, `material_id`, `question_text`, `choices` (JSON array), `correct_answer`, `bloom_level`.
7.  **`student_progress`**: Stores `user_id`, `course_id`, spaced-repetition metrics like `interval`, `next_review_date`.

Storage Bucket:
1.  **`course_materials`**: Used for storing uploaded `.pdf` files.

## Instructions
Please provide a comprehensive, step-by-step plan and code snippets for:
1.  Setting up the connection to the new database (Turbo) in a Next.js App Router environment.
2.  Setting up the connection to the new Storage platform.
3.  Creating the necessary schema/tables in the new database based on our current data breakdown.
4.  Rewriting an example data-fetching hook or Server Action to replace typical Supabase client calls (e.g., `supabase.from('questions').insert(...)` and `supabase.storage.from('course_materials').upload(...)`).
5.  Ensuring that we can securely pass the user ID from Supabase Auth to our new database platform during inserts and updates.

How should we structure the database connection library and what is the first step you recommend taking to replace the `supabase` client for data operations?
