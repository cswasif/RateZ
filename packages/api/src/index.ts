import { Hono } from 'hono'
import { cors } from 'hono/cors'
import facultyRoutes from './routes/faculty'
import reviewsRoutes from './routes/reviews'
import authRoutes from './routes/auth'

// TypeScript types for Cloudflare bindings
export interface Env {
  // D1 Database
  DB: D1Database

  // KV Storage (match wrangler.toml binding names)
  SESSIONS: KVNamespace
  NULLIFIERS: KVNamespace

  // Durable Objects
  CHAT_ROOM: DurableObjectNamespace

  // Environment variables
  ENVIRONMENT: string
  JWT_SECRET?: string  // Optional, set in production
}

// Create Hono app with environment types
const app = new Hono<{ Bindings: Env }>()

// Add CORS middleware (restrict in production)
app.use('/*', cors({
  origin: (origin, c) => {
    // Allow localhost in dev, restrict in production
    const allowedOrigins = c.env.ENVIRONMENT === 'production'
      ? ['https://ratemyprof.bracu.ac.bd', 'https://zk-ratemyprof.pages.dev']
      : ['http://localhost:5173', 'http://localhost:3000']
    return allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}))

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})

// Faculty routes
app.route('/api/faculty', facultyRoutes)

// Reviews routes
app.route('/api/reviews', reviewsRoutes)

// Auth routes
app.route('/api/auth', authRoutes)

// Export the Hono app as default
export default app

// Export Durable Objects
export { ChatRoom } from './durable-objects/ChatRoom'