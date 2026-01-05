/**
 * Mock ZK Verifier for Development
 * 
 * This module simulates ZK proof verification during development.
 * Replace with real snarkjs verification when circuits are compiled.
 */

export interface ZKProof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol?: string;
  curve?: string;
}

interface VerifyResult {
  valid: boolean;
  error?: string;
}

class MockZKVerifier {
  /**
   * Mock verify a ZK proof
   * In development, accepts all proofs with valid structure
   * In production, replace with real snarkjs.groth16.verify()
   */
  async verifyProof(proof: ZKProof, publicSignals: string[]): Promise<boolean> {
    console.log('[MockZKVerifier] Verifying proof...');

    // Basic structure validation
    if (!proof || !publicSignals) {
      console.log('[MockZKVerifier] Missing proof or publicSignals');
      return false;
    }

    // Validate proof structure (Groth16)
    if (!proof.pi_a || !Array.isArray(proof.pi_a) || proof.pi_a.length < 2) {
      console.log('[MockZKVerifier] Invalid pi_a');
      return false;
    }

    if (!proof.pi_b || !Array.isArray(proof.pi_b) || proof.pi_b.length < 2) {
      console.log('[MockZKVerifier] Invalid pi_b');
      return false;
    }

    if (!proof.pi_c || !Array.isArray(proof.pi_c) || proof.pi_c.length < 2) {
      console.log('[MockZKVerifier] Invalid pi_c');
      return false;
    }

    if (!Array.isArray(publicSignals) || publicSignals.length === 0) {
      console.log('[MockZKVerifier] Invalid publicSignals');
      return false;
    }

    // Check for expected domain hash in publicSignals[0] (mock check)
    // In real verification, this would be the nullifier from the circuit
    const nullifier = publicSignals[0];
    if (!nullifier || nullifier.length < 10) {
      console.log('[MockZKVerifier] Invalid nullifier in publicSignals');
      return false;
    }

    console.log('[MockZKVerifier] ✅ Proof structure valid (mock verification passed)');
    return true;
  }

  /**
   * Extract nullifier from public signals
   */
  extractNullifier(publicSignals: string[]): string | null {
    if (!publicSignals || publicSignals.length === 0) {
      return null;
    }
    // First public signal is typically the nullifier
    return publicSignals[0];
  }

  /**
   * Extract domain from public signals (for verification)
   */
  extractDomainHash(publicSignals: string[]): string | null {
    if (!publicSignals || publicSignals.length < 2) {
      return null;
    }
    // Second public signal is typically the domain hash
    return publicSignals[1];
  }
}

// Export singleton instance
export const mockZKVerifier = new MockZKVerifier();