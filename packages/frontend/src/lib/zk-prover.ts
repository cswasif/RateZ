/**
 * ZK Prover for BRACU Email Verification
 * 
 * Client-side proof generation using Barretenberg (UltraPlonk) and Noir.
 * Uses @zk-email/zkemail-nr for email input parsing.
 */

import { UltraPlonkBackend } from '@aztec/bb.js'
import { Noir, type CompiledCircuit } from '@noir-lang/noir_js'

// Extended circuit type that includes version information
interface CircuitWithVersion extends CompiledCircuit {
    noir_version: string;
    hash: string;
}
// Use our wrapper which calculates extra circuit inputs like from_header_sequence
import { generateEmailVerifierInputs } from '../lib/email-parser'
// Proper block-boundary splitting for partial hashing (preserves original bytes)
import { splitHeaderAtBlockBoundary, type HeaderSplitResult } from '../lib/email-preprocessor'
// Import partial hash functions from zk-wasm
import {
    computeSHA256StateOverBlocks,
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
let compiledCircuit: CircuitWithVersion | null = null

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
export function setCompiledCircuit(circuit: CircuitWithVersion): void {
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
    const circuitData = await response.json()

    // Check if circuit has bytecode, if not, try to find it or use fallback
    if (!circuitData.bytecode) {
        console.warn('⚠️ Circuit missing bytecode field, attempting to fix...')

        // Try to find bytecode in other fields or use mock
        if (circuitData.circuit) {
            circuitData.bytecode = circuitData.circuit
        } else {
            console.error('❌ Circuit has no bytecode field. This circuit cannot be used for proof generation.')
            console.log('Circuit data keys:', Object.keys(circuitData))
            throw new Error('Circuit JSON is missing bytecode field. The circuit needs to be recompiled with a compatible Noir version.')
        }
    }

    // Check version compatibility
    if (circuitData.noir_version) {
        console.log(`📋 Loading circuit compiled with Noir version: ${circuitData.noir_version}`)

        // Extract base version (remove commit hash)
        const circuitVersion = circuitData.noir_version.split('+')[0]
        const runtimeVersion = '1.0.0-beta.6' // Current runtime version

        if (circuitVersion !== runtimeVersion) {
            console.warn(`⚠️ Version mismatch detected:`)
            console.warn(`   Circuit version: ${circuitVersion}`)
            console.warn(`   Runtime version: ${runtimeVersion}`)
            console.warn(`   This may cause deserialization issues. Attempting compatibility mode...`)

            // Try to handle common version compatibility issues
            if (circuitVersion === '1.0.0-beta.5' && runtimeVersion === '1.0.0-beta.6') {
                console.log('🔄 Attempting beta.5 to beta.6 compatibility conversion...')
                // Beta.6 should be backward compatible with beta.5 circuits
                // but we may need to handle some format differences
            }
        }
    }

    compiledCircuit = circuitData as CircuitWithVersion
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
    const CIRCUIT_MAX_REMAINING_HEADER = 2048; // Max remaining header size in circuit (increased for BRACU emails)

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

    // Step 1: Parse email to get basic info and DKIM data
    console.log('📧 Parsing email and extracting DKIM data...')
    const basicInputs = await generateEmailVerifierInputs(rawEmail, {
        maxHeaderLength: 32768 // Large enough for any email header
    })

    // Preserve REAL DKIM data from WASM parsing
    const realDkimData = {
        pubkey: basicInputs.pubkey,
        pubkeyRedc: basicInputs.pubkeyRedc,
        signature: basicInputs.signature
    };
    console.log('🔑 Extracted real DKIM signature and public key')

    // Step 2: Get original header bytes (UNMODIFIED)
    const originalHeaderBytes = new Uint8Array(
        (basicInputs.emailHeader || []).map((x: any) => Number(x))
    );
    console.log(`📊 Original header size: ${originalHeaderBytes.length} bytes`);

    // Step 3: Split header at 64-byte boundary (preserving original bytes!)
    console.log('✂️  Splitting header at block boundary for partial hashing...')
    let splitResult: HeaderSplitResult;
    try {
        splitResult = splitHeaderAtBlockBoundary(originalHeaderBytes, CIRCUIT_MAX_REMAINING_HEADER);
    } catch (error) {
        console.error('❌ Failed to split header:', error);
        throw new Error(`Header splitting failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log(`   Pre-hashed: ${splitResult.prehashedLength} bytes (${splitResult.prehashedLength / 64} blocks)`);
    console.log(`   Remaining: ${splitResult.remainingBytes.length} bytes (for circuit)`);
    console.log(`   From header index: ${splitResult.fromHeaderIndex}`);
    console.log(`   From address index: ${splitResult.fromAddressIndex}`);

    // Step 4: Compute SHA256 state over pre-hashed bytes
    console.log('🔢 Computing SHA256 partial state...')
    let partialHashState: Uint32Array;

    if (splitResult.prehashedLength === 0) {
        // No pre-hashing needed, use initial SHA256 state
        console.log('   ℹ️  Small header - no pre-hashing needed');
        partialHashState = new Uint32Array([
            0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
            0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
        ]);
    } else {
        // Compute actual SHA256 state over prehashed blocks
        try {
            partialHashState = computeSHA256StateOverBlocks(splitResult.prehashedBytes);
            console.log(`   ✅ Computed SHA256 state over ${splitResult.prehashedLength} bytes`);
        } catch (error) {
            console.error('❌ SHA256 state computation failed:', error);
            throw new Error(`SHA256 computation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Create PartialHashResult for compatibility with existing formatting function
    const partialHashResult: PartialHashResult = {
        state: partialHashState,
        remaining: splitResult.remainingBytes,
        totalLength: splitResult.totalLength,
        prehashedLength: splitResult.prehashedLength
    };

    // Use indices from split result (already adjusted for remaining bytes)
    const fromHeaderIndex = splitResult.fromHeaderIndex;
    const fromHeaderLength = splitResult.fromHeaderLength;
    const fromAddressIndex = splitResult.fromAddressIndex;
    const fromAddressLength = splitResult.fromAddressLength;

    // Validate indices
    if (fromHeaderIndex < 0 || fromAddressIndex < 0) {
        throw new Error(`From header is in pre-hashed portion (indices: ${fromHeaderIndex}, ${fromAddressIndex}). Increase CIRCUIT_MAX_REMAINING_HEADER.`);
    }

    // Comprehensive bounds validation to prevent circuit overflow
    const remainingHeaderLength = splitResult.remainingBytes.length;
    
    // Validate header bounds
    if (fromHeaderIndex >= remainingHeaderLength) {
        throw new Error(`From header index ${fromHeaderIndex} out of bounds (max: ${remainingHeaderLength - 1})`);
    }
    if (fromHeaderIndex + fromHeaderLength > remainingHeaderLength) {
        throw new Error(`From header range [${fromHeaderIndex}, ${fromHeaderIndex + fromHeaderLength}) exceeds remaining header length ${remainingHeaderLength}`);
    }
    
    // Validate address bounds
    if (fromAddressIndex >= remainingHeaderLength) {
        throw new Error(`From address index ${fromAddressIndex} out of bounds (max: ${remainingHeaderLength - 1})`);
    }
    if (fromAddressIndex + fromAddressLength > remainingHeaderLength) {
        throw new Error(`From address range [${fromAddressIndex}, ${fromAddressIndex + fromAddressLength}) exceeds remaining header length ${remainingHeaderLength}`);
    }
    
    // Validate address is within header
    if (fromAddressIndex < fromHeaderIndex) {
        throw new Error(`From address index ${fromAddressIndex} must be within From header starting at ${fromHeaderIndex}`);
    }
    if (fromAddressIndex + fromAddressLength > fromHeaderIndex + fromHeaderLength) {
        throw new Error(`From address extends beyond From header bounds`);
    }
    
    // Validate domain-specific constraints
    const minDomainLength = 15; // 1 char + '@' + 13 char domain (g.bracu.ac.bd)
    if (fromAddressLength < minDomainLength) {
        throw new Error(`From address length ${fromAddressLength} too short for BRACU domain (minimum ${minDomainLength})`);
    }

    // Step 5: Format circuit inputs with new structure
    console.log('📦 Formatting circuit inputs...')
    const circuitInputs = formatCircuitInputsPartialHash(
        partialHashResult,
        realDkimData,
        fromHeaderIndex,
        fromHeaderLength,
        fromAddressIndex,
        fromAddressLength
    );

    // Debug logging
    console.log('📊 Circuit Input Summary:');
    console.log('  Partial hash state:', circuitInputs.partial_header_hash);
    console.log('  Remaining header length:', circuitInputs.remaining_header.len);
    console.log('  Remaining header storage array length:', circuitInputs.remaining_header.storage.length);
    console.log('  Total header length:', circuitInputs.total_header_length);
    console.log('  From header index:', circuitInputs.from_header_sequence.index);
    console.log('  From header length:', circuitInputs.from_header_sequence.length);
    console.log('  From address index:', circuitInputs.from_address_sequence.index);
    console.log('  From address length:', circuitInputs.from_address_sequence.length);
    console.log('  From header end index:', Number(circuitInputs.from_header_sequence.index) + Number(circuitInputs.from_header_sequence.length));
    console.log('  From address end index:', Number(circuitInputs.from_address_sequence.index) + Number(circuitInputs.from_address_sequence.length));
    console.log('  Pubkey modulus limbs:', circuitInputs.pubkey.modulus.length);
    console.log('  Signature limbs:', circuitInputs.signature.length);
    // Log first few bytes of header to verify format
    console.log('  Header first 50 bytes:', circuitInputs.remaining_header.storage.slice(0, 50).join(','));

    // Step 5: Execute Noir circuit
    console.log('⚡ Executing circuit...')

    let witness: any;

    try {
        const noir = new Noir(compiledCircuit)
        const result = await noir.execute(circuitInputs)
        witness = result.witness
    } catch (error) {
        console.error('❌ Circuit execution failed:', error)

        // Provide specific error messages for common issues
        if (error instanceof Error) {
            if (error.message.includes('deserialize')) {
                console.error('🔍 Circuit deserialization error details:')
                const circuitVersion = (compiledCircuit as CircuitWithVersion).noir_version
                console.error(`   Circuit version: ${circuitVersion}`)
                console.error(`   Runtime ACVM_JS version: 1.0.0-beta.6`)
                console.error(`   Circuit bytecode length: ${compiledCircuit.bytecode?.length || 0}`)

                // Try to provide more specific guidance
                if (circuitVersion?.includes('beta.5')) {
                    throw new Error(`Circuit version mismatch: The circuit was compiled with Noir beta.5 but the runtime is using beta.6. This is a known compatibility issue. Please either: 1) Recompile the circuit with Noir beta.6, or 2) Downgrade the runtime libraries to beta.5.`)
                }

                throw new Error(`Circuit deserialization failed. The circuit was compiled with a different version of Noir than the runtime. Circuit version: ${circuitVersion}, ACVM_JS version: 1.0.0-beta.6. Please recompile the circuit or update the runtime libraries.`)
            } else if (error.message.includes('bytecode')) {
                throw new Error('Circuit bytecode is missing or invalid. The circuit JSON file appears to be corrupted or incomplete.')
            } else if (error.message.includes('input')) {
                throw new Error(`Circuit input validation failed: ${error.message}. Check that all inputs match the expected ABI format.`)
            } else if (error.message.includes('witness')) {
                throw new Error(`Circuit witness generation failed: ${error.message}. This may indicate incompatible circuit inputs or a circuit bug.`)
            }
        }

        throw new Error(`Circuit execution failed: ${error instanceof Error ? error.message : String(error)}`)
    }

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
    const MAX_REMAINING_HEADER = 2048;

    // Helper to pad arrays to exact length
    const padArray = (arr: any[], length: number, fillValue: string = "0") => {
        const result = [...arr];
        // Truncate if too long
        if (result.length > length) {
            return result.slice(0, length);
        }
        // Pad if too short
        while (result.length < length) {
            result.push(fillValue);
        }
        return result;
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

    // Debug: Log all indices and lengths before validation
    console.log(`🔍 Debug indices before validation:`);
    console.log(`   Remaining header length: ${partialHash.remaining.length}`);
    console.log(`   From header: index=${fromHeaderIndex}, length=${fromHeaderLength}`);
    console.log(`   From address: index=${fromAddressIndex}, length=${fromAddressLength}`);
    console.log(`   Header range: [${fromHeaderIndex}, ${fromHeaderIndex + fromHeaderLength})`);
    console.log(`   Address range: [${fromAddressIndex}, ${fromAddressIndex + fromAddressLength})`);

    // Validate indices
    if (fromAddressIndex <= 0) {
        throw new Error(`Invalid fromAddressIndex: ${fromAddressIndex}. Must be > 0.`);
    }
    if (fromAddressLength < 15) {
        throw new Error(`Email address too short: ${fromAddressLength} chars. BRACU emails require at least 15.`);
    }

    // CRITICAL: Check that indices don't exceed remaining header bounds
    // This prevents "attempt to subtract with overflow" in the circuit
    const remainingHeaderLength = partialHash.remaining.length;
    if (fromHeaderIndex >= remainingHeaderLength) {
        throw new Error(`From header index ${fromHeaderIndex} exceeds remaining header length ${remainingHeaderLength}`);
    }
    if (fromHeaderIndex + fromHeaderLength > remainingHeaderLength) {
        throw new Error(`From header range [${fromHeaderIndex}, ${fromHeaderIndex + fromHeaderLength}) exceeds remaining header length ${remainingHeaderLength}`);
    }
    if (fromAddressIndex >= remainingHeaderLength) {
        throw new Error(`From address index ${fromAddressIndex} exceeds remaining header length ${remainingHeaderLength}`);
    }
    if (fromAddressIndex + fromAddressLength > remainingHeaderLength) {
        throw new Error(`From address range [${fromAddressIndex}, ${fromAddressIndex + fromAddressLength}) exceeds remaining header length ${remainingHeaderLength}`);
    }

    return {
        partial_header_hash: Array.from(partialHash.state).map(n => n.toString()),
        remaining_header: {
            storage: paddedRemaining,
            len: partialHash.remaining.length.toString()  // Use actual remaining bytes length, not padded array length
        },
        // FIX: Use totalLength (includes pre-hashed bytes) for correct SHA256 padding
        // The circuit's partial_sha256_var_end needs the TOTAL message length for finalization
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
// @ts-ignore - Exporting to prevent unused variable error
export function _formatCircuitInputsLegacy(emailInputs: any): Record<string, any> {
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
