import { Env } from '../index'

export interface NullifierData {
  nullifier: string
  createdAt: number
  expiresAt: number
  proofHash: string
  facultyId?: string
  semester?: string
}

export interface NullifierConfig {
  ttl: number // Time to live in seconds (default: 24 hours)
  namespace: string // KV namespace key
}

export class NullifierManager {
  private env: Env
  private config: NullifierConfig

  constructor(env: Env, config: Partial<NullifierConfig> = {}) {
    this.env = env
    this.config = {
      ttl: 24 * 60 * 60, // 24 hours
      namespace: 'nullifiers',
      ...config
    }
  }

  /**
   * Generate a secure nullifier from proof data
   */
  async generateNullifier(
    proof: any,
    publicSignals: string[],
    facultyId?: string,
    semester?: string
  ): Promise<string> {
    return generateSecureNullifier(proof, publicSignals, facultyId, semester)
  }

  /**
   * Check if a nullifier already exists
   */
  async exists(nullifier: string): Promise<boolean> {
    try {
      const existing = await this.env.NULLIFIERS.get(nullifier)
      return existing !== null
    } catch (error) {
      console.error('Error checking nullifier existence:', error)
      // On error, assume it exists (fail-safe for security)
      throw new Error('Failed to check nullifier existence')
    }
  }

  /**
   * Store a nullifier with metadata
   */
  async store(
    nullifier: string,
    proofHash: string,
    facultyId?: string,
    semester?: string
  ): Promise<boolean> {
    try {
      const nullifierData: NullifierData = {
        nullifier,
        createdAt: Date.now(),
        expiresAt: Date.now() + (this.config.ttl * 1000),
        proofHash,
        facultyId,
        semester
      }

      await this.env.NULLIFIERS.put(
        nullifier,
        JSON.stringify(nullifierData),
        { expirationTtl: this.config.ttl }
      )

      return true
    } catch (error) {
      console.error('Error storing nullifier:', error)
      return false
    }
  }

  /**
   * Get nullifier data if it exists
   */
  async get(nullifier: string): Promise<NullifierData | null> {
    try {
      const data = await this.env.NULLIFIERS.get(nullifier)
      if (!data) {
        return null
      }

      return JSON.parse(data) as NullifierData
    } catch (error) {
      console.error('Error getting nullifier:', error)
      return null
    }
  }

  /**
   * Delete a nullifier (for cleanup or testing)
   */
  async delete(nullifier: string): Promise<boolean> {
    try {
      await this.env.NULLIFIERS.delete(nullifier)
      return true
    } catch (error) {
      console.error('Error deleting nullifier:', error)
      return false
    }
  }

  /**
   * Validate a nullifier against a proof
   */
  async validate(
    nullifier: string,
    proof: any,
    publicSignals: string[]
  ): Promise<boolean> {
    try {
      // Check if nullifier exists
      if (await this.exists(nullifier)) {
        return false
      }

      // In production, this would verify the proof against the nullifier
      // For now, we'll just check that the nullifier format is valid
      // zk_ (3 chars) + 64 hex chars = 67 total
      return nullifier.startsWith('zk_') && nullifier.length === 67
    } catch (error) {
      console.error('Error validating nullifier:', error)
      return false
    }
  }

  /**
   * Batch check multiple nullifiers
   */
  async batchExists(nullifiers: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>()

    try {
      const promises = nullifiers.map(async (nullifier) => {
        const exists = await this.exists(nullifier)
        results.set(nullifier, exists)
      })

      await Promise.all(promises)
    } catch (error) {
      console.error('Error in batch nullifier check:', error)
    }

    return results
  }

  /**
   * Get nullifier statistics
   */
  async getStats(): Promise<{
    totalNullifiers: number
    activeNullifiers: number
    expiredNullifiers: number
  }> {
    // This would require listing keys from KV, which has limitations
    // For now, return mock stats - in production, you'd track this separately
    return {
      totalNullifiers: 0,
      activeNullifiers: 0,
      expiredNullifiers: 0
    }
  }

  /**
   * Clean up expired nullifiers (for maintenance)
   */
  async cleanup(): Promise<number> {
    // KV automatically handles expiration, so this is mostly for manual cleanup
    // In production, you might want to implement a more sophisticated cleanup
    console.log('Nullifier cleanup completed - KV handles expiration automatically')
    return 0
  }
}

// Export factory function for easy instantiation
export function createNullifierManager(env: Env, config?: Partial<NullifierConfig>): NullifierManager {
  return new NullifierManager(env, config)
}

// Export utility functions for direct usage
export async function generateSecureNullifier(
  proof: any,
  publicSignals: string[],
  facultyId?: string,
  semester?: string
): Promise<string> {
  const proofData = JSON.stringify({ proof, publicSignals, facultyId, semester })
  const encoder = new TextEncoder()
  const data = encoder.encode(proofData)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return `zk_${hashHex}`
}

export async function verifyNullifierUniqueness(
  env: Env,
  nullifier: string
): Promise<boolean> {
  try {
    const existing = await env.NULLIFIERS.get(nullifier)
    return existing === null
  } catch (error) {
    console.error('Error verifying nullifier uniqueness:', error)
    return false
  }
}