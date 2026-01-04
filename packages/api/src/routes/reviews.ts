import { Hono } from 'hono'
import { Env } from '../index'

// Create reviews router
const reviews = new Hono<{ Bindings: Env }>()

// Helper function to generate secure nullifier using SHA-256
async function generateNullifier(sessionId: string, facultyId: string, semester: string): Promise<string> {
  const data = `nullifier:${sessionId}:${facultyId}:${semester}`
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// POST /api/reviews - Submit review with nullifier check
reviews.post('/', async (c) => {
  try {
    // Validate session token from Authorization header
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Authorization header required' }, 401)
    }

    const sessionToken = authHeader.substring(7)

    // Get session from KV store
    const sessionData = await c.env.SESSIONS.get(`session:${sessionToken}`)
    if (!sessionData) {
      return c.json({ error: 'Invalid or expired session' }, 401)
    }

    const session = JSON.parse(sessionData)

    // Parse request body
    const body = await c.req.json()
    const {
      faculty_id,
      course_id,
      rating,
      difficulty,
      would_take_again,
      comment,
      grade_received,
      semester,
      year
    } = body

    // Validate required fields
    if (!faculty_id || rating === undefined || !semester) {
      return c.json({ error: 'faculty_id, rating, and semester are required' }, 400)
    }

    // Validate rating is integer in range
    const ratingNum = Number(rating)
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return c.json({ error: 'Rating must be an integer between 1 and 5' }, 400)
    }

    // Validate difficulty if provided
    if (difficulty !== undefined && difficulty !== null) {
      const diffNum = Number(difficulty)
      if (!Number.isInteger(diffNum) || diffNum < 1 || diffNum > 5) {
        return c.json({ error: 'Difficulty must be an integer between 1 and 5' }, 400)
      }
    }

    // Validate comment length
    if (comment && comment.length > 2000) {
      return c.json({ error: 'Comment must be 2000 characters or less' }, 400)
    }

    // Validate grade_received format
    const validGrades = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F', 'W', 'I']
    if (grade_received && !validGrades.includes(grade_received)) {
      return c.json({ error: 'Invalid grade format' }, 400)
    }

    // Check if faculty exists
    const facultyExists = await c.env.DB.prepare(
      'SELECT id FROM faculty WHERE id = ?'
    ).bind(faculty_id).first()

    if (!facultyExists) {
      return c.json({ error: 'Faculty not found' }, 404)
    }

    // Generate secure nullifier using SHA-256
    const nullifier = await generateNullifier(session.sessionId, String(faculty_id), semester)

    // Check nullifier doesn't exist (prevent duplicate)
    const existingNullifier = await c.env.DB.prepare(
      'SELECT id FROM reviews WHERE nullifier = ?'
    ).bind(nullifier).first()

    if (existingNullifier) {
      return c.json({
        error: 'You have already submitted a review for this faculty this semester'
      }, 409)
    }

    // Insert review
    const reviewResult = await c.env.DB.prepare(
      `INSERT INTO reviews (faculty_id, course_id, rating, difficulty, would_take_again, comment, grade_received, nullifier, semester, year) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      faculty_id,
      course_id || null,
      ratingNum,
      difficulty || null,
      would_take_again === true,
      comment || null,
      grade_received || null,
      nullifier,
      semester,
      year || new Date().getFullYear()
    ).run()

    // Update faculty's avg_rating and total_reviews atomically
    await c.env.DB.prepare(
      `UPDATE faculty 
       SET avg_rating = (SELECT ROUND(AVG(rating), 1) FROM reviews WHERE faculty_id = ?),
           total_reviews = (SELECT COUNT(*) FROM reviews WHERE faculty_id = ?),
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`
    ).bind(faculty_id, faculty_id, faculty_id).run()

    // Return success (WITHOUT nullifier!)
    const newReview = await c.env.DB.prepare(
      `SELECT r.id, r.faculty_id, r.course_id, r.rating, r.difficulty, 
              r.would_take_again, r.comment, r.grade_received, r.semester, r.year, r.created_at,
              c.code as course_code, c.name as course_name 
       FROM reviews r 
       LEFT JOIN courses c ON r.course_id = c.id 
       WHERE r.id = ?`
    ).bind(reviewResult.meta.last_row_id).first()

    return c.json({
      message: 'Review submitted successfully',
      review: newReview
    }, 201)

  } catch (error) {
    console.error('Review submission error:', error)
    return c.json({ error: 'Failed to submit review' }, 500)
  }
})

// GET /api/reviews - List reviews (filter by faculty_id, course_id)
reviews.get('/', async (c) => {
  try {
    const { faculty_id, course_id, page = '1', limit = '20' } = c.req.query()

    const pageNum = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))
    const offset = (pageNum - 1) * limitNum

    // Explicitly list columns - NO nullifier!
    let query = `
      SELECT r.id, r.faculty_id, r.course_id, r.rating, r.difficulty, 
             r.would_take_again, r.comment, r.grade_received, r.semester, r.year, r.created_at,
             f.name as faculty_name, 
             c.code as course_code, c.name as course_name 
      FROM reviews r 
      JOIN faculty f ON r.faculty_id = f.id 
      LEFT JOIN courses c ON r.course_id = c.id 
      WHERE 1=1
    `
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM reviews r 
      WHERE 1=1
    `
    const params: any[] = []
    const countParams: any[] = []

    // Add faculty filter
    if (faculty_id) {
      query += ' AND r.faculty_id = ?'
      countQuery += ' AND r.faculty_id = ?'
      params.push(faculty_id)
      countParams.push(faculty_id)
    }

    // Add course filter
    if (course_id) {
      query += ' AND r.course_id = ?'
      countQuery += ' AND r.course_id = ?'
      params.push(course_id)
      countParams.push(course_id)
    }

    // Add pagination
    query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?'

    // Execute queries
    const [reviewsResult, countResult] = await Promise.all([
      c.env.DB.prepare(query).bind(...params, limitNum, offset).all(),
      c.env.DB.prepare(countQuery).bind(...countParams).all()
    ])

    const total = (countResult.results[0] as any)?.total || 0
    const totalPages = Math.ceil(total / limitNum) || 1

    return c.json({
      reviews: reviewsResult.results,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    })

  } catch (error) {
    console.error('Reviews fetch error:', error)
    return c.json({ error: 'Failed to fetch reviews' }, 500)
  }
})

export default reviews