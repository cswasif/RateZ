/**
 * Enhanced ZK WASM Prover with Real Integration
 * 
 * This module provides both mock and real ZK proof generation capabilities.
 * It can use either the mock prover for development or the real zk-wasm
 * crate when available.
 */

import { initZK, generateProof as wasmGenerateProof, quickGenerate } from './zk-wasm';
import { mockWASMProver } from './mock-prover';

export interface ProofResult {
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
  };
  publicSignals: string[];
}

export interface ZKProverConfig {
  useRealProver: boolean;
  mockDelay?: number;
}

class EnhancedZKProver {
  private config: ZKProverConfig;
  private prover: any = null;
  private initialized = false;

  constructor(config: ZKProverConfig = { useRealProver: false, mockDelay: 3000 }) {
    this.config = config;
  }

  /**
   * Initialize the ZK prover (either real or mock)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.config.useRealProver) {
      try {
        const { prover } = await initZK();
        this.prover = prover;
        console.log('[EnhancedZKProver] ✅ Real zk-wasm prover initialized');
      } catch (error) {
        console.warn('[EnhancedZKProver] Failed to initialize real prover, falling back to mock:', error);
        this.config.useRealProver = false;
      }
    }

    if (!this.config.useRealProver) {
      console.log('[EnhancedZKProver] Using mock prover for development');
    }

    this.initialized = true;
  }

  /**
   * Generate a ZK proof (either real or mock)
   */
  async generateProof(inputs: any): Promise<ProofResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    console.log('[EnhancedZKProver] Generating proof with inputs:', inputs);

    if (this.config.useRealProver && this.prover) {
      try {
        // Convert inputs to the format expected by zk-wasm
        const wasmInputs = this.convertToWasmInputs(inputs);
        const result = await wasmGenerateProof(this.prover, wasmInputs);
        
        console.log('[EnhancedZKProver] ✅ Real proof generated');
        return {
          proof: result.proof,
          publicSignals: result.publicSignals
        };
      } catch (error) {
        console.warn('[EnhancedZKProver] Real proof generation failed, falling back to mock:', error);
      }
    }

    // Fallback to mock prover
    console.log('[EnhancedZKProver] Using mock prover');
    return await mockWASMProver.computeProof(inputs);
  }

  /**
   * Quick proof generation for development/testing
   */
  async quickGenerateProof(inputs: any): Promise<ProofResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.config.useRealProver && this.prover) {
      try {
        const result = await quickGenerate(inputs);
        return {
          proof: result.proof,
          publicSignals: result.publicSignals
        };
      } catch (error) {
        console.warn('[EnhancedZKProver] Quick generation failed, using mock:', error);
      }
    }

    // Use mock prover with reduced delay for quick testing
    const { MockWASMProver } = await import('./mock-prover');
    const quickMockProver = new MockWASMProver(500);
    return await quickMockProver.computeProof(inputs);
  }

  /**
   * Convert frontend inputs to wasm-compatible format
   */
  private convertToWasmInputs(inputs: any): Record<string, string[]> {
    // Convert the inputs to the format expected by zk-wasm
    // This is a simplified conversion - adjust based on your circuit requirements
    return {
      emailHash: [inputs.emailHash || '0x0'],
      domain: [inputs.domain || 'g.bracu.ac.bd'],
      timestamp: [inputs.timestamp || Date.now().toString()],
      // Add other input fields as needed
    };
  }

  /**
   * Get prover status
   */
  getStatus(): string {
    if (!this.initialized) return 'Not initialized';
    return this.config.useRealProver ? 'Real prover ready' : 'Mock prover ready';
  }
}

// Export singleton instance with default configuration
export const enhancedZKProver = new EnhancedZKProver({
  useRealProver: false, // Set to true when you want to use real zk-wasm
  mockDelay: 3000
});

// Export factory function for custom configurations
export function createEnhancedZKProver(config: ZKProverConfig): EnhancedZKProver {
  return new EnhancedZKProver(config);
}