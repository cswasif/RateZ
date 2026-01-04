-- Database schema for ZK Rate My Professor
-- Simplified to match connect.json data structure
-- Faculty = initials only (e.g., "RAI", "AFM")

-- Faculty table (identified by initials)
CREATE TABLE IF NOT EXISTS faculty (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    initials TEXT NOT NULL UNIQUE,  -- "RAI", "AFM", "TBA"
    avg_rating REAL DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,  -- "CSE110", "MAT110"
    credits INTEGER DEFAULT 3,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Faculty-Course mapping (from connect.json sections)
CREATE TABLE IF NOT EXISTS faculty_courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    faculty_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    section_id INTEGER,  -- from connect.json sectionId
    semester TEXT,  -- "Spring 2026"
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(faculty_id, course_id, section_id),
    FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Reviews table (ANONYMOUS)
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    faculty_id INTEGER NOT NULL,
    course_id INTEGER,
    
    -- Ratings (1-5)
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    difficulty INTEGER CHECK (difficulty >= 1 AND difficulty <= 5),
    
    -- Additional feedback
    would_take_again BOOLEAN DEFAULT FALSE,
    comment TEXT,
    grade_received TEXT,  -- A, A-, B+, etc.
    
    -- Anti-spam: ZK nullifier (hash of session + faculty + semester)
    nullifier TEXT NOT NULL UNIQUE,
    
    -- Metadata
    semester TEXT,
    year INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (faculty_id) REFERENCES faculty(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_faculty_initials ON faculty(initials);
CREATE INDEX IF NOT EXISTS idx_faculty_avg_rating ON faculty(avg_rating DESC);
CREATE INDEX IF NOT EXISTS idx_courses_code ON courses(code);
CREATE INDEX IF NOT EXISTS idx_faculty_courses_faculty ON faculty_courses(faculty_id);
CREATE INDEX IF NOT EXISTS idx_faculty_courses_course ON faculty_courses(course_id);
CREATE INDEX IF NOT EXISTS idx_reviews_faculty ON reviews(faculty_id);
CREATE INDEX IF NOT EXISTS idx_reviews_course ON reviews(course_id);
CREATE INDEX IF NOT EXISTS idx_reviews_nullifier ON reviews(nullifier);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(created_at DESC);