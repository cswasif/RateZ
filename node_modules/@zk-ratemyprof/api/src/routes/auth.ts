import { Hono } from 'hono'
import { Env } from '../index'
import { ZKVerifier, NoirProof } from '../lib/zk-verifier'

// Create auth router
const auth = new Hono<{ Bindings: Env }>()

// Generate cryptographically secure session token
function generateSessionToken(): string {
  return crypto.randomUUID()
}

// Generate anonymous session commitment from public inputs
async function generateSessionCommitment(publicInputs: string[]): Promise<string> {
  // For BRACU verifier: publicInputs[0] = pubkey_hash, publicInputs[1] = nullifier
  // Use the nullifier as the session commitment (it's already unique per email)
  const data = publicInputs.join(':')
  const encoder = new TextEncoder()
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// POST /api/auth/verify - Verify Noir/UltraPlonk proof and create anonymous session
auth.post('/verify', async (c) => {
  try {
    const body = await c.req.json()
    const { proof, publicInputs } = body

    // Validate required fields (new Noir proof format)
    if (!proof || !publicInputs) {
      return c.json({ error: 'proof and publicInputs are required' }, 400)
    }

    // Validate proof is an array of bytes (Noir format)
    if (!Array.isArray(proof)) {
      return c.json({ error: 'proof must be an array of bytes' }, 400)
    }

    // Validate publicInputs is array with 2 elements (pubkey_hash, nullifier)
    if (!Array.isArray(publicInputs) || publicInputs.length !== 2) {
      return c.json({
        error: 'publicInputs must be an array with 2 elements: [pubkey_hash, nullifier]'
      }, 400)
    }

    // Create NoirProof object
    const noirProof: NoirProof = {
      proof: proof,
      publicInputs: publicInputs
    }

    // Verify ZK proof using Barretenberg UltraPlonk verifier
    const verifier = new ZKVerifier(c.env)
    const result = await verifier.verifyProof(noirProof)

    if (!result.valid) {
      return c.json({
        error: 'ZK proof verification failed',
        details: result.error
      }, 401)
    }

    // Extract nullifier from public inputs (used for replay protection)
    const emailNullifier = verifier.extractNullifier(publicInputs)
    if (!emailNullifier) {
      return c.json({ error: 'Could not extract nullifier from proof' }, 400)
    }

    // Check if this nullifier has been used before (replay attack prevention)
    const existingNullifier = await c.env.NULLIFIERS.get(`nullifier:${emailNullifier}`)
    if (existingNullifier) {
      return c.json({ error: 'This email has already been used for verification' }, 409)
    }

    // Store the nullifier to prevent replay
    await c.env.NULLIFIERS.put(`nullifier:${emailNullifier}`, 'used', {
      expirationTtl: 365 * 24 * 60 * 60 // 1 year - prevent same email from being reused
    })

    // Generate anonymous session commitment
    const sessionCommitment = await generateSessionCommitment(publicInputs)

    // Generate session token (random, not linked to identity)
    const sessionToken = generateSessionToken()

    // Create anonymous session data
    // NOTE: No studentId, email, or any identifying info!
    const sessionData = {
      sessionId: sessionCommitment,
      nullifier: emailNullifier, // Store for review nullifier generation
      createdAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    }

    // Store session in KV with expiry (24 hours)
    await c.env.SESSIONS.put(
      `session:${sessionToken}`,
      JSON.stringify(sessionData),
      { expirationTtl: 24 * 60 * 60 } // 24 hours in seconds
    )

    return c.json({
      message: 'Verified successfully - you can now submit reviews anonymously',
      sessionToken,
      expiresIn: 24 * 60 * 60, // 24 hours in seconds
      proofHash: result.proofHash
      // NOTE: No identifying info returned!
    })

  } catch (error) {
    console.error('Auth verification error:', error)
    return c.json({ error: 'Verification failed' }, 500)
  }
})

// DELETE /api/auth/logout - Invalidate session
auth.delete('/logout', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Authorization header required' }, 401)
    }

    const sessionToken = authHeader.substring(7)

    // Check if session exists
    const sessionData = await c.env.SESSIONS.get(`session:${sessionToken}`)
    if (!sessionData) {
      return c.json({ error: 'Session not found' }, 404)
    }

    // Delete session from KV store
    await c.env.SESSIONS.delete(`session:${sessionToken}`)

    return c.json({ message: 'Logged out successfully' })

  } catch (error) {
    console.error('Logout error:', error)
    return c.json({ error: 'Logout failed' }, 500)
  }
})

// GET /api/auth/session - Check session validity (anonymous)
auth.get('/session', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Authorization header required' }, 401)
    }

    const sessionToken = authHeader.substring(7)

    // Get session from KV store
    const sessionDataStr = await c.env.SESSIONS.get(`session:${sessionToken}`)
    if (!sessionDataStr) {
      return c.json({ error: 'Session not found or expired' }, 401)
    }

    const session = JSON.parse(sessionDataStr)

    // Check if session is expired
    if (Date.now() > session.expiresAt) {
      await c.env.SESSIONS.delete(`session:${sessionToken}`)
      return c.json({ error: 'Session expired' }, 401)
    }

    // Calculate remaining time
    const expiresIn = Math.floor((session.expiresAt - Date.now()) / 1000)

    // Return only non-identifying info
    return c.json({
      valid: true,
      expiresIn
      // NOTE: No sessionId or any identifying info exposed to client!
    })

  } catch (error) {
    console.error('Session check error:', error)
    return c.json({ error: 'Session validation failed' }, 500)
  }
})

// POST /api/auth/upload-circuit - Upload compiled circuit bytecode (admin endpoint)
auth.post('/upload-circuit', async (c) => {
  try {
    const body = await c.req.json()
    const { bytecode } = body

    if (!bytecode || typeof bytecode !== 'string') {
      return c.json({ error: 'bytecode is required and must be a string' }, 400)
    }

    // Store circuit bytecode
    const verifier = new ZKVerifier(c.env)
    await verifier.setCircuitBytecode(bytecode)

    return c.json({
      message: 'Circuit bytecode uploaded successfully',
      bytecodeLength: bytecode.length
    })

  } catch (error) {
    console.error('Circuit upload error:', error)
    return c.json({ error: 'Failed to upload circuit' }, 500)
  }
})

export default auth