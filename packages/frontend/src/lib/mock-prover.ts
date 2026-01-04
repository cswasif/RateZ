/**
 * Mock WASM Prover for Development
 * 
 * Simulates ZK proof generation during development when real circuits
 * are not yet compiled. Replace with real snarkjs when circuits are ready.
 */

interface ProofResult {
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
  };
  publicSignals: string[];
}

class MockWASMProver {
  private delay: number;

  constructor(delay: number = 3000) {
    this.delay = delay; // Simulate proof generation time
  }

  /**
   * Generate a mock ZK proof
   * Simulates the time-consuming proof generation process
   */
  async computeProof(inputs: any): Promise<ProofResult> {
    console.log('[MockProver] Starting proof generation...');
    console.log('[MockProver] Inputs:', inputs);

    // Simulate proof generation delay (real proofs take 10-60 seconds)
    await new Promise(resolve => setTimeout(resolve, this.delay));

    // Generate deterministic mock proof based on inputs
    const inputHash = await this.hashInputs(inputs);

    // Create mock Groth16 proof structure
    const proof = {
      pi_a: [
        '0x' + inputHash.slice(0, 64),
        '0x' + inputHash.slice(64, 128) || '0x' + '0'.repeat(64),
        '0x1'
      ],
      pi_b: [
        [
          '0x' + this.rotateHash(inputHash, 1).slice(0, 64),
          '0x' + this.rotateHash(inputHash, 2).slice(0, 64)
        ],
        [
          '0x' + this.rotateHash(inputHash, 3).slice(0, 64),
          '0x' + this.rotateHash(inputHash, 4).slice(0, 64)
        ],
        ['0x1', '0x0']
      ],
      pi_c: [
        '0x' + this.rotateHash(inputHash, 5).slice(0, 64),
        '0x' + this.rotateHash(inputHash, 6).slice(0, 64),
        '0x1'
      ],
      protocol: 'groth16',
      curve: 'bn128'
    };

    // Generate public signals
    // Signal 0: Nullifier (unique per email)
    // Signal 1: Domain hash (proves @g.bracu.ac.bd)
    const publicSignals = [
      '0x' + inputHash.slice(0, 64),  // Nullifier
      '0x' + await this.hashDomain('g.bracu.ac.bd'),  // Domain hash
    ];

    console.log('[MockProver] ✅ Proof generated successfully');

    return { proof, publicSignals };
  }

  /**
   * Hash inputs to create deterministic mock values
   */
  private async hashInputs(inputs: any): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(inputs));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Hash a domain string
   */
  private async hashDomain(domain: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(domain);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Simple hash rotation for generating unique values
   */
  private rotateHash(hash: string, amount: number): string {
    const rotation = amount % hash.length;
    return hash.slice(rotation) + hash.slice(0, rotation);
  }
}

// Export both class and singleton instance
export { MockWASMProver };
export const mockWASMProver = new MockWASMProver(3000);