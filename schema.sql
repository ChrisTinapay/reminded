-- Legacy SQLite schema (Turso / libSQL). Do NOT run this in Supabase.
-- For Supabase Postgres, use: supabase/schema.sql
--
-- SQLite Schema for Turso Migration

-- 1. Profiles (Linked to Supabase Auth ID)
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY, -- Stores the Supabase auth.userId UUID
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  academic_level_id TEXT,
  program_id TEXT,
  shard_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Courses (Created by students)
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  student_id TEXT NOT NULL, -- References profiles(id)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Note: We omit academic_levels and programs entirely per the simplified new schema, 
-- or you could add them back if still required to filter courses.

-- 3. Learning Materials (Uploaded PDFs) — Each material = a "Topic"
CREATE TABLE IF NOT EXISTS learning_materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Path from the storage bucket
  topic_name TEXT,         -- User-defined topic name
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- 4. Questions (Generated from materials)
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  material_id INTEGER,
  question_text TEXT NOT NULL,
  choices TEXT NOT NULL, -- Stored as JSON string '["A", "B", "C", "D"]'
  correct_answer TEXT NOT NULL,
  bloom_level TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (material_id) REFERENCES learning_materials(id) ON DELETE SET NULL
);

-- 5. Student Progress (Spaced Repetition Tracking)
CREATE TABLE IF NOT EXISTS student_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL, -- References profiles(id)
  course_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  interval INTEGER DEFAULT 0,
  ease_factor REAL DEFAULT 2.5,
  next_review_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, question_id), -- One progress record per user per question
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- 6. Indexes for Performance Optimization

-- Questions indexes
CREATE INDEX IF NOT EXISTS idx_master_questions_course ON questions(course_id);
CREATE INDEX IF NOT EXISTS idx_master_questions_material ON questions(material_id);
CREATE INDEX IF NOT EXISTS idx_master_next_review ON questions(next_review_date);

-- Student Progress indexes (most queried table)
CREATE INDEX IF NOT EXISTS idx_sp_user_course ON student_progress(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_sp_user_review_date ON student_progress(user_id, next_review_date);
CREATE INDEX IF NOT EXISTS idx_sp_user_course_review ON student_progress(user_id, course_id, next_review_date);
CREATE INDEX IF NOT EXISTS idx_sp_question_id ON student_progress(question_id);

-- Courses index
CREATE INDEX IF NOT EXISTS idx_courses_student ON courses(student_id);

-- Learning Materials index
CREATE INDEX IF NOT EXISTS idx_lm_course ON learning_materials(course_id);
