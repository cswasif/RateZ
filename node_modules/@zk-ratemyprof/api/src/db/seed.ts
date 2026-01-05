/**
 * Seed script to import connect.json data into D1 database
 * 
 * This script:
 * 1. Extracts REAL faculty (excludes TBA)
 * 2. Extracts unique courses
 * 3. Creates many-to-many faculty-course mappings
 * 
 * Usage:
 *   npx tsx src/db/seed.ts > src/db/seed.sql
 *   npx wrangler d1 execute DB --local --file=src/db/seed.sql
 */

// @ts-ignore - JSON import
import connectData from '../connect.json'

interface Section {
    sectionId: number
    courseId: number
    courseCode: string
    courseCredit: number
    faculties: string | null
    sectionName: string
    semesterSessionId: number
}

// Extract unique faculty initials and courses
function extractData(data: Section[]) {
    const facultySet = new Set<string>()
    const courseMap = new Map<string, number>() // code -> credits
    const facultyCourseSet = new Set<string>() // "FACULTY|COURSE" for dedup
    const facultyCourses: Array<{ faculty: string, course: string, sectionId: number }> = []

    let tbaCount = 0
    let realFacultyCount = 0

    for (const section of data) {
        // Add course regardless of faculty
        if (section.courseCode) {
            courseMap.set(section.courseCode, section.courseCredit || 3)
        }

        // Handle faculty
        if (!section.faculties || section.faculties.trim() === '' || section.faculties === 'TBA') {
            tbaCount++
            continue // Skip TBA and empty faculty
        }

        realFacultyCount++

        // Handle multiple faculty (comma-separated like "RAI, AFM")
        const facultyList = section.faculties.split(',').map(f => f.trim().toUpperCase())

        for (const faculty of facultyList) {
            if (!faculty || faculty === 'TBA') continue

            facultySet.add(faculty)

            // Add faculty-course mapping (deduped)
            if (section.courseCode) {
                const key = `${faculty}|${section.courseCode}`
                if (!facultyCourseSet.has(key)) {
                    facultyCourseSet.add(key)
                    facultyCourses.push({
                        faculty,
                        course: section.courseCode,
                        sectionId: section.sectionId
                    })
                }
            }
        }
    }

    return {
        faculty: Array.from(facultySet).sort(),
        courses: Array.from(courseMap.entries()).map(([code, credits]) => ({ code, credits })).sort((a, b) => a.code.localeCompare(b.code)),
        facultyCourses,
        stats: {
            tbaCount,
            realFacultyCount,
            totalSections: data.length
        }
    }
}

// Generate SQL statements
function generateSQL(data: Section[]): string {
    const { faculty, courses, facultyCourses, stats } = extractData(data)

    let sql = `-- Auto-generated seed data from connect.json
-- Generated at: ${new Date().toISOString()}
-- Total sections: ${stats.totalSections}
-- TBA sections (skipped): ${stats.tbaCount}
-- Real faculty sections: ${stats.realFacultyCount}
-- Unique faculty: ${faculty.length}
-- Unique courses: ${courses.length}
-- Faculty-course mappings: ${facultyCourses.length}

`

    // Insert faculty (excluding TBA)
    sql += '-- ============================================\n'
    sql += '-- FACULTY (by initials, TBA excluded)\n'
    sql += '-- ============================================\n'
    for (const initials of faculty) {
        sql += `INSERT OR IGNORE INTO faculty (initials) VALUES ('${initials}');\n`
    }

    // Insert courses
    sql += '\n-- ============================================\n'
    sql += '-- COURSES\n'
    sql += '-- ============================================\n'
    for (const course of courses) {
        sql += `INSERT OR IGNORE INTO courses (code, credits) VALUES ('${course.code}', ${course.credits});\n`
    }

    // Insert faculty-course mappings
    sql += '\n-- ============================================\n'
    sql += '-- FACULTY-COURSE MAPPINGS (many-to-many)\n'
    sql += '-- ============================================\n'
    for (const fc of facultyCourses) {
        sql += `INSERT OR IGNORE INTO faculty_courses (faculty_id, course_id, section_id, semester) 
  SELECT f.id, c.id, ${fc.sectionId}, 'Spring 2026'
  FROM faculty f, courses c 
  WHERE f.initials = '${fc.faculty}' AND c.code = '${fc.course}';\n`
    }

    return sql
}

// Run if executed directly
const data = connectData as Section[]
const { faculty, courses, facultyCourses, stats } = extractData(data)

console.log('===========================================')
console.log('  CONNECT.JSON SEED DATA ANALYSIS')
console.log('===========================================')
console.log(`Total sections in file: ${stats.totalSections}`)
console.log(`TBA sections (SKIPPED): ${stats.tbaCount}`)
console.log(`Real faculty sections:  ${stats.realFacultyCount}`)
console.log('-------------------------------------------')
console.log(`Unique faculty found:   ${faculty.length}`)
console.log(`Unique courses found:   ${courses.length}`)
console.log(`Faculty-course pairs:   ${facultyCourses.length}`)
console.log('-------------------------------------------')
console.log('\nSample faculty initials:')
console.log(faculty.slice(0, 20).join(', '))
console.log('\nSample courses:')
console.log(courses.slice(0, 10).map(c => `${c.code} (${c.credits} cr)`).join(', '))
console.log('===========================================')

export { extractData, generateSQL }
