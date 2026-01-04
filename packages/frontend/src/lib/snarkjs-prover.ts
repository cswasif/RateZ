/**
 * Snarkjs-based Proof Generator for BRACU Email Verification
 * 
 * Uses the circuit files from /circuits folder:
 * - bracu_verifier_simple.wasm (6MB) - Witness generator
 * - verification_key.json (6KB) - For local verification
 * 
 * NOTE: The proving key (bracu_verifier_simple_0000.zkey) is 382MB and needs
 * to be hosted on a CDN or loaded in chunks. For development, we use mock proofs.
 */

// snarkjs will be loaded dynamically
let snarkjs: any = null;

interface CircuitInputs {
    // Email header components
    emailHeader?: number[];
    emailHeaderLength?: number;
    // DKIM signature
    signature?: Uint8Array;
    // Domain to verify
    domainIndex?: number;
    // Modulus for RSA
    n?: Uint8Array;
    // Hash preimage indices
    prefixIndex?: number;
    suffixIndex?: number;
}

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

class SnarkjsProver {
    private initialized = false;
    private wasmPath = '/circuits/bracu_verifier_simple.wasm';
    private zkeyPath = '/circuits/bracu_verifier_simple_0000.zkey'; // Large file - may need CDN
    private zkeyLoaded = false;

    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            // Dynamically import snarkjs (it's a large library)
            const snarkjsModule = await import('snarkjs');
            snarkjs = snarkjsModule;
            this.initialized = true;
            console.log('[SnarkjsProver] ✅ snarkjs loaded');
        } catch (error) {
            console.error('[SnarkjsProver] Failed to load snarkjs:', error);
            throw new Error('Failed to initialize snarkjs prover');
        }
    }

    /**
     * Check if the large zkey file is available
     */
    async checkZkeyAvailable(): Promise<boolean> {
        try {
            const response = await fetch(this.zkeyPath, { method: 'HEAD' });
            this.zkeyLoaded = response.ok && response.headers.get('content-length') !== '1598'; // Check not mock
            return this.zkeyLoaded;
        } catch {
            return false;
        }
    }

    /**
     * Generate a ZK proof using snarkjs
     * 
     * @param inputs Circuit inputs for witness generation
     * @returns Groth16 proof and public signals
     */
    async generateProof(inputs: CircuitInputs): Promise<ProofResult> {
        await this.initialize();

        // Check if we have the full zkey or need to use mock
        const hasZkey = await this.checkZkeyAvailable();

        if (!hasZkey) {
            console.warn('[SnarkjsProver] Using mock proof - zkey not available (382MB file needed)');
            return this.generateMockProof(inputs);
        }

        try {
            console.log('[SnarkjsProver] Generating real proof...');

            // Generate the proof using snarkjs groth16
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                inputs,
                this.wasmPath,
                this.zkeyPath
            );

            console.log('[SnarkjsProver] ✅ Real proof generated');

            return {
                proof: {
                    pi_a: proof.pi_a,
                    pi_b: proof.pi_b,
                    pi_c: proof.pi_c,
                    protocol: 'groth16',
                    curve: 'bn128'
                },
                publicSignals
            };
        } catch (error) {
            console.error('[SnarkjsProver] Proof generation failed:', error);
            throw error;
        }
    }

    /**
     * Verify a proof locally (for testing/development)
     */
    async verifyProof(proof: ProofResult): Promise<boolean> {
        await this.initialize();

        try {
            const vkeyResponse = await fetch('/circuits/verification_key.json');
            const vkey = await vkeyResponse.json();

            return await snarkjs.groth16.verify(vkey, proof.publicSignals, proof.proof);
        } catch (error) {
            console.error('[SnarkjsProver] Verification failed:', error);
            return false;
        }
    }

    /**
     * Generate a mock proof for development when zkey is not available
     */
    private generateMockProof(_inputs: CircuitInputs): ProofResult {
        // Generate realistic-looking mock proof values
        const mockG1Point = () => [
            "21568907949068746477602261308186430031467706553398510671839358088821016969704",
            "3986730628267832147838652614925421456850889839821389011413296899403558764456",
            "1"
        ];

        const mockG2Point = () => [
            ["10857046999023057135944570762232829481370756359578518086990519993285655852781", "11559732032986387107991004021392285783925812861821192530917403151452391805634"],
            ["8495653923123431417604973247489272438418190587263600148770280649306958101930", "4082367875863433681332203403145435568316851327593401208105741076214120093531"],
            ["1", "0"]
        ];

        // Generate 19 public signals (matching our circuit's nPublic)
        const publicSignals = Array.from({ length: 19 }, (_, i) =>
            BigInt(Date.now() + i * 1000000).toString()
        );

        return {
            proof: {
                pi_a: mockG1Point(),
                pi_b: mockG2Point() as string[][],
                pi_c: mockG1Point(),
                protocol: 'groth16',
                curve: 'bn128'
            },
            publicSignals
        };
    }
}

// Export singleton instance
export const snarkjsProver = new SnarkjsProver();

// Export for custom usage
export { SnarkjsProver };
export type { CircuitInputs, ProofResult };
