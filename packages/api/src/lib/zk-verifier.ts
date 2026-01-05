/**
 * ZK Verifier for BRACU Email Verification using Barretenberg (UltraPlonk)
 * 
 * Migrated from snarkjs/Groth16 to @aztec/bb.js for Noir circuit compatibility.
 */

import { Env } from '../index'

// Circuit bytecode will be loaded from compiled Noir circuit
// For now, we'll use a placeholder that will be replaced after compilation
let circuitBytecode: string | null = null

export interface NoirProof {
  proof: number[]  // UltraPlonk proof bytes
  publicInputs: string[]  // Public outputs from circuit
}

export interface VerificationResult {
  valid: boolean
  error?: string
  publicInputs?: string[]
  proofHash?: string
}

/**
 * Dynamically import Barretenberg backend
 * This is necessary because bb.js uses WASM and needs async loading
 */
async function getBackend() {
  const { UltraPlonkBackend } = await import('@aztec/bb.js')
  return UltraPlonkBackend
}

export class ZKVerifier {
  private env: Env
  private backendPromise: Promise<any> | null = null

  constructor(env: Env) {
    this.env = env
  }

  /**
   * Initialize the UltraPlonk backend with circuit bytecode
   */
  private async initBackend() {
    if (!circuitBytecode) {
      // Try to load from KV storage
      const stored = await this.env.NULLIFIERS.get('circuit_bytecode')
      if (stored) {
        circuitBytecode = stored
      } else {
        // Fallback for Development: Fetch from Frontend Dev Server
        // Note: checking environment variable availability 
        if (this.env.ENVIRONMENT !== 'production') {
          console.log('Dev mode: Fetching circuit from frontend...');
          try {
            const res = await fetch('http://localhost:5173/circuits/bracu_verifier.json');
            if (res.ok) {
              const circuit = await res.json() as any; // Cast as necessary
              circuitBytecode = JSON.stringify(circuit); // Bytecode property?
              // Wait, CompiledCircuit is an object.
              // initBackend expects string? 
              // No, setCircuitBytecode takes string.
              // But initBackend passes it to UltraPlonkBackend.
              // UltraPlonkBackend takes Uint8Array | number[] | object?
              // Check zk-verifier.ts line 57: new UltraPlonkBackend(circuitBytecode, ...)
              // If circuitBytecode is the JSON string, bb.js might handle it?
              // Or bb.js expects the `bytecode` FIELD from the JSON.

              if (circuit.bytecode) {
                circuitBytecode = circuit.bytecode;
              } else {
                // Maybe it's the full JSON object
                circuitBytecode = JSON.stringify(circuit);
              }
            }
          } catch (e) {
            console.warn('Failed to fetch circuit from frontend:', e);
          }
        }

        if (!circuitBytecode) {
          throw new Error('Circuit bytecode not loaded. Please deploy the compiled circuit.')
        }
      }
    }

    const UltraPlonkBackend = await getBackend()
    return new UltraPlonkBackend(circuitBytecode, { threads: 1 })
  }

  /**
   * Set the circuit bytecode for verification
   */
  async setCircuitBytecode(bytecode: string): Promise<void> {
    circuitBytecode = bytecode
    // Store in KV for persistence
    await this.env.NULLIFIERS.put('circuit_bytecode', bytecode, {
      expirationTtl: 365 * 24 * 60 * 60 // 1 year
    })
  }

  /**
   * Validate the structure of a Noir proof
   */
  private validateProofStructure(proof: NoirProof): { valid: boolean; error?: string } {
    try {
      if (!proof.proof || !Array.isArray(proof.proof)) {
        return { valid: false, error: 'Missing proof array' }
      }

      if (!proof.publicInputs || !Array.isArray(proof.publicInputs)) {
        return { valid: false, error: 'Missing publicInputs array' }
      }

      // Proof should be non-empty bytes
      if (proof.proof.length === 0) {
        return { valid: false, error: 'Empty proof' }
      }

      // Validate proof bytes are in valid range
      for (const byte of proof.proof) {
        if (typeof byte !== 'number' || byte < 0 || byte > 255) {
          return { valid: false, error: 'Invalid proof byte value' }
        }
      }

      // BRACU verifier returns 2 public outputs: [pubkey_hash, email_nullifier]
      if (proof.publicInputs.length !== 2) {
        return {
          valid: false,
          error: `Expected 2 public inputs, got ${proof.publicInputs.length}`
        }
      }

      return { valid: true }
    } catch (error) {
      return { valid: false, error: `Structure validation error: ${error}` }
    }
  }

  /**
   * Generate proof hash for storage and comparison
   */
  private async generateProofHash(proof: NoirProof): Promise<string> {
    const proofData = JSON.stringify({
      proof: proof.proof,
      publicInputs: proof.publicInputs
    })

    const encoder = new TextEncoder()
    const data = encoder.encode(proofData)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Verify a Noir/UltraPlonk proof
   */
  async verifyProof(proof: NoirProof): Promise<VerificationResult> {
    try {
      // Validate proof structure
      const structureValidation = this.validateProofStructure(proof)
      if (!structureValidation.valid) {
        return {
          valid: false,
          error: structureValidation.error
        }
      }

      try {
        // Initialize Barretenberg backend
        const backend = await this.initBackend()

        // Convert proof to ProofData format expected by bb.js
        const proofData = {
          proof: new Uint8Array(proof.proof),
          publicInputs: proof.publicInputs
        }

        // Verify the proof using UltraPlonk
        const isValid = await backend.verifyProof(proofData)

        // Clean up
        await backend.destroy()

        if (!isValid) {
          return { valid: false, error: 'Invalid Zero-Knowledge Proof' }
        }

        // Generate hash for audit
        const proofHash = await this.generateProofHash(proof)

        return {
          valid: true,
          publicInputs: proof.publicInputs,
          proofHash
        }
      } catch (error) {
        console.error('UltraPlonk verification failed:', error)
        return { valid: false, error: `Verification failed: ${error}` }
      }
    } catch (error) {
      return {
        valid: false,
        error: `Verification error: ${error}`
      }
    }
  }

  /**
   * Extract nullifier from public inputs
   * BRACU verifier outputs: [pubkey_hash, email_nullifier]
   */
  extractNullifier(publicInputs: string[]): string | null {
    if (publicInputs.length >= 2) {
      return publicInputs[1] // email_nullifier is second output
    }
    return null
  }

  /**
   * Extract pubkey hash from public inputs
   */
  extractPubkeyHash(publicInputs: string[]): string | null {
    if (publicInputs.length >= 1) {
      return publicInputs[0] // pubkey_hash is first output
    }
    return null
  }

  /**
   * Get verification statistics
   */
  async getStats(): Promise<{
    totalVerifications: number
    successfulVerifications: number
    failedVerifications: number
    lastVerification: number | null
  }> {
    // In a production system, you would track these metrics
    return {
      totalVerifications: 0,
      successfulVerifications: 0,
      failedVerifications: 0,
      lastVerification: null
    }
  }
}

// Export factory function
export function createZKVerifier(env: Env): ZKVerifier {
  return new ZKVerifier(env)
}

// Export standalone verification (for testing without Env)
export async function verifyNoirProofStandalone(
  proof: NoirProof,
  circuitBytecodeStr: string
): Promise<VerificationResult> {
  try {
    const { UltraPlonkBackend } = await import('@aztec/bb.js')
    const backend = new UltraPlonkBackend(circuitBytecodeStr, { threads: 1 })

    const proofData = {
      proof: new Uint8Array(proof.proof),
      publicInputs: proof.publicInputs
    }

    const isValid = await backend.verifyProof(proofData)
    await backend.destroy()

    return {
      valid: isValid,
      publicInputs: proof.publicInputs
    }
  } catch (error) {
    return {
      valid: false,
      error: `Standalone verification failed: ${error}`
    }
  }
}