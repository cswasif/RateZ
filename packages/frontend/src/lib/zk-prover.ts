/**
 * ZK Prover for BRACU Email Verification
 * 
 * Client-side proof generation using Barretenberg (UltraPlonk) and Noir.
 * Uses @zk-email/zkemail-nr for email input parsing.
 */

import { UltraPlonkBackend } from '@aztec/bb.js'
import { Noir, type CompiledCircuit } from '@noir-lang/noir_js'
// Use our wrapper which calculates extra circuit inputs like from_header_sequence
import { generateEmailVerifierInputs } from '../lib/email-parser'

// Manual WASM initialization imports
import initAcvm from '@noir-lang/acvm_js';
import initAbi from '@noir-lang/noirc_abi';

// Import WASM URLs (assuming they are in public folder or resolved by Vite)
// We use direct paths to public/ which we copied
const ACVM_WASM_URL = '/acvm_js_bg.wasm';
const NOIRC_ABI_WASM_URL = '/noirc_abi_wasm_bg.wasm';

// Import compiled circuit - this will be added after compilation
// For now, we'll use dynamic loading
let compiledCircuit: CompiledCircuit | null = null

export interface ProofResult {
    proof: number[]
    publicInputs: string[]
    nullifier: string
    pubkeyHash: string
}

export interface ProverOptions {
    threads?: number
    maxHeaderLength?: number
}

/**
 * Set the compiled circuit JSON
 */
export function setCompiledCircuit(circuit: CompiledCircuit): void {
    compiledCircuit = circuit
}

/**
 * Load circuit from URL (for lazy loading)
 */
export async function loadCircuitFromUrl(url: string): Promise<void> {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Failed to load circuit: ${response.statusText}`)
    }
    compiledCircuit = await response.json() as CompiledCircuit
}

/**
 * Generate ZK proof for BRACU email verification
 * 
 * @param rawEmail - Raw email content (MIME format with headers)
 * @param options - Prover options
 * @returns Proof data with nullifier
 */
export async function generateBRACUProof(
    rawEmail: string,
    options: ProverOptions = {}
): Promise<ProofResult> {
    const { threads = 1, maxHeaderLength = 512 } = options

    if (!compiledCircuit) {
        throw new Error('Circuit not loaded. Call setCompiledCircuit() or loadCircuitFromUrl() first.')
    }

    console.log('🔐 Generating ZK proof for BRACU email...')

    // Initialize WASM manually if needed
    try {
        console.log('⚡ Initializing Noir WASM...');
        await Promise.all([
            initAcvm(fetch(ACVM_WASM_URL)),
            initAbi(fetch(NOIRC_ABI_WASM_URL))
        ]);
        console.log('✅ Noir WASM initialized');
    } catch (e) {
        console.warn('⚠️ WASM initialization warning (might be already initialized):', e);
    }


    // Step 1: Parse email and generate circuit inputs using zkemail-nr
    console.log('📧 Parsing email and extracting DKIM data...')
    const emailInputs = await generateEmailVerifierInputs(rawEmail, {
        maxHeaderLength: maxHeaderLength
    })

    // Step 2: Format inputs for the Noir circuit
    const circuitInputs = formatCircuitInputs(emailInputs)

    // Debug logging
    console.log('📊 Circuit Input Summary:');
    console.log('  Header length:', circuitInputs.header.len);
    console.log('  From header index:', circuitInputs.from_header_sequence.index);
    console.log('  From header length:', circuitInputs.from_header_sequence.length);
    console.log('  From address index:', circuitInputs.from_address_sequence.index);
    console.log('  From address length:', circuitInputs.from_address_sequence.length);
    console.log('  Pubkey modulus limbs:', circuitInputs.pubkey.modulus.length);
    console.log('  Signature limbs:', circuitInputs.signature.length);

    // Step 3: Execute Noir circuit to generate witness
    console.log('⚡ Executing circuit...')
    const noir = new Noir(compiledCircuit)
    const { witness } = await noir.execute(circuitInputs)

    // Step 4: Generate UltraPlonk proof
    console.log('🔒 Generating UltraPlonk proof...')
    const backend = new UltraPlonkBackend(compiledCircuit.bytecode, { threads })
    const proofData = await backend.generateProof(witness)

    // Clean up
    await backend.destroy()

    // Extract outputs
    const publicInputs = proofData.publicInputs as string[]
    const pubkeyHash = publicInputs[0] || ''
    const nullifier = publicInputs[1] || ''

    console.log('✅ Proof generated successfully!')
    console.log(`   Nullifier: ${nullifier.slice(0, 20)}...`)

    return {
        proof: Array.from(proofData.proof),
        publicInputs,
        nullifier,
        pubkeyHash
    }
}

/**
 * Format email inputs for the bracu_verifier Noir circuit
 */
function formatCircuitInputs(emailInputs: any): Record<string, any> {
    console.log("Formatting circuit inputs with strict types... Input keys:", Object.keys(emailInputs));

    // Safety check
    if (!emailInputs) throw new Error("emailInputs is undefined");

    // Helper to ensure values are numbers
    const toNumber = (v: any) => Number(v || 0);

    // Note: email-parser.ts returns `emailHeader` as number[], so no mapping needed if typed correctly
    // But we act safely just in case.
    const headerStorage = Array.isArray(emailInputs.emailHeader)
        ? emailInputs.emailHeader.map((x: any) => Number(x))
        : [];

    const headerLen = toNumber(emailInputs.emailHeaderLength);

    // Helper to pad arrays to 18 limbs
    const padArray = (arr: any[], length: number) => {
        const padded = [...arr];
        while (padded.length < length) {
            padded.push("0");
        }
        return padded;
    };

    // Recalculate REDC parameter if key size mismatch
    // redc = -N^-1 mod R, where R = 2^(18 * 120)
    const TARGET_LIMBS = 18;
    const LIMB_BITS = 120;

    let pubkeyModulus = emailInputs.pubkey;
    let pubkeyRedc = emailInputs.pubkeyRedc || emailInputs.pubkey;

    // If key is smaller (e.g. 1024 bits = 9 limbs), we must RECALCULATE redc for 2048-bit circuit (18 limbs)
    if (pubkeyModulus.length < TARGET_LIMBS) {
        console.log("Recalculating Redc for 1024-bit key compatibility...");
        try {
            // 1. Reconstruct N from limbs (little-endian)
            let N = BigInt(0);
            for (let i = 0; i < pubkeyModulus.length; i++) {
                N += BigInt(pubkeyModulus[i]) * (BigInt(1) << (BigInt(i) * BigInt(LIMB_BITS)));
            }

            // 2. Calculate R = 2^(18 * 120)
            const R_exp = BigInt(TARGET_LIMBS * LIMB_BITS);
            const R = BigInt(1) << R_exp;

            // 3. Calculate redc = -N^-1 mod R
            // We use Extended Euclidean Algorithm for modular inverse
            // Since R is power of 2 and N is odd (RSA modulus), inverse exists.

            // Helper for modInverse(a, m)
            const modInverse = (a: bigint, m: bigint): bigint => {
                let [old_r, r] = [a, m];
                let [old_s, s] = [BigInt(1), BigInt(0)];
                let [old_t, t] = [BigInt(0), BigInt(1)]; // Not strictly needed for result but part of algo

                while (r !== BigInt(0)) {
                    const quotient = old_r / r;
                    [old_r, r] = [r, old_r - quotient * r];
                    [old_s, s] = [s, old_s - quotient * s];
                    [old_t, t] = [t, old_t - quotient * t];
                }

                // Result is old_s. Ensure positive.
                if (old_s < 0) old_s += m;
                return old_s;
            };

            // Calculation: redc = (R - modInverse(N, R)) % R
            // Or technically: N * N' = -1 mod R  =>  N' = -N^-1 
            // -x mod R is (R - (x mod R)) % R
            const n_inv = modInverse(N, R);
            const redc_val = (R - n_inv) % R;

            // 4. Split redc into 18 limbs
            const newRedcLimbs: string[] = [];
            let tempRedc = redc_val;
            const mask = (BigInt(1) << BigInt(LIMB_BITS)) - BigInt(1);

            for (let i = 0; i < TARGET_LIMBS; i++) {
                newRedcLimbs.push((tempRedc & mask).toString());
                tempRedc >>= BigInt(LIMB_BITS);
            }

            pubkeyRedc = newRedcLimbs;
            // Modulus still just needs padding
            pubkeyModulus = padArray(pubkeyModulus, TARGET_LIMBS);
        } catch (e) {
            console.error("Failed to recalculate redc:", e);
            // Fallback (will likely fail proof but better than crash)
            pubkeyRedc = padArray(pubkeyRedc, TARGET_LIMBS);
            pubkeyModulus = padArray(pubkeyModulus, TARGET_LIMBS);
        }
    } else {
        // Just ensure length is exactly right if roughly correct
        pubkeyModulus = padArray(pubkeyModulus, TARGET_LIMBS);
        pubkeyRedc = padArray(pubkeyRedc, TARGET_LIMBS);
    }

    return {
        header: {
            storage: headerStorage,
            len: headerLen
        },
        pubkey: {
            modulus: pubkeyModulus,
            redc: pubkeyRedc
        },
        signature: padArray(emailInputs.signature, TARGET_LIMBS),
        from_header_sequence: {
            index: toNumber(emailInputs.fromHeaderIndex),
            length: toNumber(emailInputs.fromHeaderLength)
        },
        from_address_sequence: {
            index: toNumber(emailInputs.fromAddressIndex),
            length: toNumber(emailInputs.fromAddressLength)
        }
    };
}

/**
 * Verify a proof locally (for testing)
 */
export async function verifyProofLocally(proof: ProofResult): Promise<boolean> {
    if (!compiledCircuit) {
        throw new Error('Circuit not loaded')
    }

    const backend = new UltraPlonkBackend(compiledCircuit.bytecode, { threads: 1 })

    const proofData = {
        proof: new Uint8Array(proof.proof),
        publicInputs: proof.publicInputs
    }

    const isValid = await backend.verifyProof(proofData)
    await backend.destroy()

    return isValid
}

/**
 * Get the circuit bytecode (for sending to API)
 */
export function getCircuitBytecode(): string | null {
    return compiledCircuit?.bytecode || null
}

/**
 * Check if the prover is ready
 */
export function isProverReady(): boolean {
    return compiledCircuit !== null
}
