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
// Import partial hash functions from zk-wasm
import {
    computePartialHash,
    computePartialHashFallback,
    isPartialHashAvailable,
    type PartialHashResult
} from '../lib/zk-wasm'

// Manual WASM initialization imports
import initAcvm from '@noir-lang/acvm_js';
import initAbi from '@noir-lang/noirc_abi';

// Import WASM URLs (assuming they are in public folder or resolved by Vite)
// We use direct paths to public/ which we copied
// const ACVM_WASM_URL = '/acvm_js_bg.wasm'; // Replaced by Vite import
// const NOIRC_ABI_WASM_URL = '/noirc_abi_wasm_bg.wasm'; // Replaced by Vite import

// Import WASM URLs using Vite's ?url suffix for proper bundling
import acvmWasm from '@noir-lang/acvm_js/web/acvm_js_bg.wasm?url';
import noircWasm from '@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm?url';

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
    const { threads = 1 } = options
    const CIRCUIT_MAX_REMAINING_HEADER = 2560; // Max remaining header size in circuit

    if (!compiledCircuit) {
        throw new Error('Circuit not loaded. Call setCompiledCircuit() or loadCircuitFromUrl() first.')
    }

    console.log('🔐 Generating ZK proof for BRACU email...')

    // Initialize WASM manually if needed
    try {
        console.log('⚡ Initializing Noir WASM...');
        await Promise.all([
            initAcvm({ module_or_path: fetch(acvmWasm) }),
            initAbi({ module_or_path: fetch(noircWasm) })
        ]);
        console.log('✅ Noir WASM initialized');
    } catch (e) {
        console.warn('⚠️ WASM initialization warning (might be already initialized):', e);
    }

    // Step 1: Parse email and extract full header
    console.log('📧 Parsing email and extracting DKIM data...')
    const emailInputs = await generateEmailVerifierInputs(rawEmail, {
        maxHeaderLength: 32768 // Large enough for any email header
    })

    // Step 2: Compute partial hash using WASM
    console.log('🔢 Computing partial SHA256 hash via WASM...')
    const headerBytes = new Uint8Array(
        (emailInputs.emailHeader || []).map((x: any) => Number(x))
    );

    let partialHashResult: PartialHashResult;
    try {
        // Try WASM first
        const wasmAvailable = await isPartialHashAvailable();
        if (wasmAvailable) {
            partialHashResult = await computePartialHash(headerBytes, CIRCUIT_MAX_REMAINING_HEADER);
            console.log(`   ✅ WASM partial hash: ${partialHashResult.prehashedLength} bytes pre-hashed, ${partialHashResult.remaining.length} bytes remaining`);
        } else {
            console.log('   ⚠️ WASM not available, using JavaScript fallback');
            partialHashResult = computePartialHashFallback(headerBytes, CIRCUIT_MAX_REMAINING_HEADER);
        }
    } catch (error) {
        console.warn('   ⚠️ Partial hash failed, using fallback:', error);
        partialHashResult = computePartialHashFallback(headerBytes, CIRCUIT_MAX_REMAINING_HEADER);
    }

    // Step 3: Recalculate From header indices relative to remaining bytes
    let fromHeaderIndex = emailInputs.fromHeaderIndex || 0;
    let fromHeaderLength = emailInputs.fromHeaderLength || 0;
    let fromAddressIndex = emailInputs.fromAddressIndex || 0;
    let fromAddressLength = emailInputs.fromAddressLength || 0;

    // Adjust indices for the offset from partial hash
    const offset = partialHashResult.prehashedLength;
    fromHeaderIndex = fromHeaderIndex - offset;
    fromAddressIndex = fromAddressIndex - offset;

    // Validate indices are within remaining header bounds
    if (fromHeaderIndex < 0 || fromHeaderIndex >= partialHashResult.remaining.length) {
        throw new Error(`From header index ${fromHeaderIndex} is out of bounds after partial hash adjustment`)
    }
    if (fromAddressIndex < 0 || fromAddressIndex >= partialHashResult.remaining.length) {
        throw new Error(`From address index ${fromAddressIndex} is out of bounds after partial hash adjustment`)
    }

    // Step 4: Format circuit inputs with new structure
    console.log('📦 Formatting circuit inputs...')
    const circuitInputs = formatCircuitInputsPartialHash(
        partialHashResult,
        emailInputs,
        fromHeaderIndex,
        fromHeaderLength,
        fromAddressIndex,
        fromAddressLength
    );

    // Debug logging
    console.log('📊 Circuit Input Summary:');
    console.log('  Partial hash state:', circuitInputs.partial_header_hash);
    console.log('  Remaining header length:', circuitInputs.remaining_header.len);
    console.log('  Total header length:', circuitInputs.total_header_length);
    console.log('  From header index:', circuitInputs.from_header_sequence.index);
    console.log('  From address index:', circuitInputs.from_address_sequence.index);

    // Step 5: Execute Noir circuit
    console.log('⚡ Executing circuit...')
    const noir = new Noir(compiledCircuit)
    const { witness } = await noir.execute(circuitInputs)

    // Step 6: Generate UltraPlonk proof
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
 * Format circuit inputs for the partial hash bracu_verifier circuit
 */
function formatCircuitInputsPartialHash(
    partialHash: PartialHashResult,
    emailInputs: any,
    fromHeaderIndex: number,
    fromHeaderLength: number,
    fromAddressIndex: number,
    fromAddressLength: number
): Record<string, any> {
    const TARGET_LIMBS = 18;
    const MAX_REMAINING_HEADER = 2560;

    // Helper to pad arrays
    const padArray = (arr: any[], length: number, fillValue: string = "0") => {
        const padded = [...arr];
        while (padded.length < length) {
            padded.push(fillValue);
        }
        return padded;
    };

    // Format remaining header as BoundedVec
    const remainingStorage = Array.from(partialHash.remaining).map((b: number) => b.toString());
    const paddedRemaining = padArray(remainingStorage, MAX_REMAINING_HEADER);

    // Format RSA pubkey
    let pubkeyModulus = emailInputs.pubkey || [];
    let pubkeyRedc = emailInputs.pubkeyRedc || emailInputs.pubkey || [];

    // Pad to 18 limbs if needed
    pubkeyModulus = padArray(pubkeyModulus, TARGET_LIMBS);
    pubkeyRedc = padArray(pubkeyRedc, TARGET_LIMBS);

    // Format signature
    const signature = padArray(emailInputs.signature || [], TARGET_LIMBS);

    // Validate indices
    if (fromAddressIndex <= 0) {
        throw new Error(`Invalid fromAddressIndex: ${fromAddressIndex}. Must be > 0.`);
    }
    if (fromAddressLength < 15) {
        throw new Error(`Email address too short: ${fromAddressLength} chars. BRACU emails require at least 15.`);
    }

    return {
        partial_header_hash: Array.from(partialHash.state).map(n => n.toString()),
        remaining_header: {
            storage: paddedRemaining,
            len: partialHash.remaining.length.toString()
        },
        total_header_length: partialHash.totalLength.toString(),
        pubkey: {
            modulus: pubkeyModulus,
            redc: pubkeyRedc
        },
        signature: signature,
        from_header_sequence: {
            index: fromHeaderIndex.toString(),
            length: fromHeaderLength.toString()
        },
        from_address_sequence: {
            index: fromAddressIndex.toString(),
            length: fromAddressLength.toString()
        }
    };
}

/**
 * @deprecated Legacy format for old circuit without partial hash
 * Kept for reference if needed for backward compatibility
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _formatCircuitInputsLegacy(emailInputs: any): Record<string, any> {
    console.log("Formatting circuit inputs with strict types... Input keys:", Object.keys(emailInputs));

    // Safety check
    if (!emailInputs) throw new Error("emailInputs is undefined");

    // Note: email-parser.ts returns `emailHeader` as number[], so no mapping needed if typed correctly
    // But we act safely just in case.
    let headerStorage = Array.isArray(emailInputs.emailHeader)
        ? emailInputs.emailHeader.map((x: any) => Number(x))
        : [];

    const headerLen = Math.min(Number(emailInputs.emailHeaderLength || 0), 2560);

    // Truncate header to circuit maximum if it's longer
    if (headerStorage.length > 2560) {
        console.warn(`Header length ${headerStorage.length} exceeds circuit maximum 2560, truncating`);
        headerStorage = headerStorage.slice(0, 2560);
    }

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

    // Validate indices to prevent circuit overflow
    const fromHeaderIndex = Number(emailInputs.fromHeaderIndex || 0)
    const fromHeaderLength = Number(emailInputs.fromHeaderLength || 0)
    const fromAddressIndex = Number(emailInputs.fromAddressIndex || 0)
    let fromAddressLength = Number(emailInputs.fromAddressLength || 0)

    // CRITICAL: Workaround for circuit bug in parse_email_address
    // The circuit has a subtraction underflow bug when address index is 0
    // Ensure address index is never 0 to prevent circuit witness generation failure
    if (fromAddressIndex === 0) {
        throw new Error(`Invalid fromAddressIndex: ${fromAddressIndex}. Circuit bug: index cannot be 0 due to subtraction underflow.`)
    }

    // Also ensure address length is valid for BRACU domain
    const bracuDomainLen = 13; // g.bracu.ac.bd
    const minLength = bracuDomainLen + 2; // 15 (1 char + @ + 13 char domain)

    if (fromAddressLength < minLength) {
        console.warn(`⚠️ Address length ${fromAddressLength} too short for BRACU domain. Adjusting to ${minLength}`)
        fromAddressLength = minLength; // Force minimum length
    }

    // Bounds validation to prevent circuit overflow
    if (fromHeaderIndex < 0 || fromHeaderIndex >= headerLen) {
        throw new Error(`Invalid fromHeaderIndex: ${fromHeaderIndex} (header length: ${headerLen})`)
    }

    if (fromHeaderLength <= 0 || fromHeaderIndex + fromHeaderLength > headerLen) {
        throw new Error(`Invalid fromHeaderLength: ${fromHeaderLength} (index: ${fromHeaderIndex}, header length: ${headerLen})`)
    }

    if (fromAddressIndex < 0 || fromAddressIndex >= headerLen) {
        throw new Error(`Invalid fromAddressIndex: ${fromAddressIndex} (header length: ${headerLen})`)
    }

    if (fromAddressLength <= 0 || fromAddressIndex + fromAddressLength > headerLen) {
        throw new Error(`Invalid fromAddressLength: ${fromAddressLength} (index: ${fromAddressIndex}, header length: ${headerLen})`)
    }

    return {
        header: {
            storage: padArray(headerStorage, 2560),
            len: headerLen
        },
        pubkey: {
            modulus: pubkeyModulus,
            redc: pubkeyRedc
        },
        signature: padArray(emailInputs.signature, TARGET_LIMBS),
        from_header_sequence: {
            index: fromHeaderIndex,
            length: fromHeaderLength
        },
        from_address_sequence: {
            index: fromAddressIndex,
            length: fromAddressLength
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
