import { Hono } from 'hono'
import { Env } from '../index'

// Create faculty router
const faculty = new Hono<{ Bindings: Env }>()

// GET /api/faculty - List all faculty with search and pagination
faculty.get('/', async (c) => {
  const { search, page = '1', limit = '20' } = c.req.query()

  try {
    const pageNum = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))
    const offset = (pageNum - 1) * limitNum

    let query = 'SELECT * FROM faculty WHERE 1=1'
    let countQuery = 'SELECT COUNT(*) as total FROM faculty WHERE 1=1'
    const params: any[] = []

    // Add search filter (search by initials)
    if (search) {
      query += ' AND initials LIKE ?'
      countQuery += ' AND initials LIKE ?'
      params.push(`%${search.toUpperCase()}%`)
    }

    // Order by avg_rating (highest first), then initials
    query += ' ORDER BY avg_rating DESC, initials ASC LIMIT ? OFFSET ?'

    // Execute queries
    const [facultyResult, countResult] = await Promise.all([
      c.env.DB.prepare(query).bind(...params, limitNum, offset).all(),
      c.env.DB.prepare(countQuery).bind(...params).all()
    ])

    const total = (countResult.results[0] as any)?.total || 0
    const totalPages = Math.ceil(total / limitNum)

    return c.json({
      faculty: facultyResult.results,
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
    console.error('Failed to fetch faculty:', error)
    return c.json({ error: 'Failed to fetch faculty' }, 500)
  }
})

// GET /api/faculty/:initials - Get single faculty by initials with reviews
faculty.get('/:initials', async (c) => {
  const initials = c.req.param('initials').toUpperCase()

  try {
    // Get faculty details
    const facultyResult = await c.env.DB.prepare(
      'SELECT * FROM faculty WHERE initials = ?'
    ).bind(initials).first()

    if (!facultyResult) {
      return c.json({ error: 'Faculty not found' }, 404)
    }

    // Get reviews for this faculty (most recent first)
    const reviewsResult = await c.env.DB.prepare(
      `SELECT r.id, r.rating, r.difficulty, r.would_take_again, r.comment, 
              r.grade_received, r.semester, r.year, r.created_at,
              c.code as course_code
       FROM reviews r 
       LEFT JOIN courses c ON r.course_id = c.id 
       WHERE r.faculty_id = ? 
       ORDER BY r.created_at DESC
       LIMIT 50`
    ).bind(facultyResult.id).all()

    // Get courses taught by this faculty
    const coursesResult = await c.env.DB.prepare(
      `SELECT DISTINCT c.id, c.code, c.credits
       FROM courses c
       INNER JOIN faculty_courses fc ON c.id = fc.course_id
       WHERE fc.faculty_id = ?
       ORDER BY c.code ASC`
    ).bind(facultyResult.id).all()

    return c.json({
      faculty: facultyResult,
      courses: coursesResult.results,
      reviews: reviewsResult.results
    })
  } catch (error) {
    console.error('Failed to fetch faculty details:', error)
    return c.json({ error: 'Failed to fetch faculty details' }, 500)
  }
})

// POST /api/faculty - Create faculty (admin only, skip auth for now)
faculty.post('/', async (c) => {
  try {
    const body = await c.req.json()
    const { initials } = body

    // Validate required fields
    if (!initials || typeof initials !== 'string' || initials.trim().length === 0) {
      return c.json({ error: 'Initials are required' }, 400)
    }

    const upperInitials = initials.toUpperCase().trim()

    // Check if initials already exist
    const existingFaculty = await c.env.DB.prepare(
      'SELECT id FROM faculty WHERE initials = ?'
    ).bind(upperInitials).first()

    if (existingFaculty) {
      return c.json({ error: 'Faculty with these initials already exists' }, 409)
    }

    // Insert new faculty
    const result = await c.env.DB.prepare(
      'INSERT INTO faculty (initials) VALUES (?)'
    ).bind(upperInitials).run()

    // Get the created faculty
    const newFaculty = await c.env.DB.prepare(
      'SELECT * FROM faculty WHERE id = ?'
    ).bind(result.meta.last_row_id).first()

    return c.json({
      message: 'Faculty created successfully',
      faculty: newFaculty
    }, 201)
  } catch (error) {
    console.error('Failed to create faculty:', error)
    return c.json({ error: 'Failed to create faculty' }, 500)
  }
})

export default faculty