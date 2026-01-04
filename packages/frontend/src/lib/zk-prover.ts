/**
 * ZK Prover for BRACU Email Verification
 * 
 * Client-side proof generation using Barretenberg (UltraPlonk) and Noir.
 * Uses @zk-email/zkemail-nr for email input parsing.
 */

import { UltraPlonkBackend } from '@aztec/bb.js'
import { Noir, CompiledCircuit } from '@noir-lang/noir_js'
import { generateEmailVerifierInputs } from '@zk-email/zkemail-nr'

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

    // Step 1: Parse email and generate circuit inputs using zkemail-nr
    console.log('📧 Parsing email and extracting DKIM data...')
    const emailInputs = await generateEmailVerifierInputs(rawEmail, {
        maxHeaderLength,
        maxBodyLength: 0, // Header-only verification for bracu_verifier
        ignoreBodyHashCheck: true
    })

    // Step 2: Format inputs for the Noir circuit
    const circuitInputs = formatCircuitInputs(emailInputs)

    // Step 3: Execute Noir circuit to generate witness
    console.log('⚡ Executing circuit...')
    const noir = new Noir(compiledCircuit)
    const { witness, returnValue } = await noir.execute(circuitInputs)

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
    // The bracu_verifier circuit expects:
    // - header: BoundedVec<u8, MAX_EMAIL_HEADER_LENGTH>
    // - pubkey: RSAPubkey<KEY_LIMBS_2048>
    // - signature: [Field; KEY_LIMBS_2048]
    // - from_header_sequence: Sequence
    // - from_address_sequence: Sequence

    return {
        header: {
            storage: emailInputs.emailHeader,
            len: emailInputs.emailHeaderLength.toString()
        },
        pubkey: {
            modulus: emailInputs.pubkey,
            redc_param: emailInputs.pubkeyRedc || emailInputs.pubkey
        },
        signature: emailInputs.signature,
        from_header_sequence: {
            index: emailInputs.fromHeaderIndex?.toString() || '0',
            length: emailInputs.fromHeaderLength?.toString() || '0'
        },
        from_address_sequence: {
            index: emailInputs.fromAddressIndex?.toString() || '0',
            length: emailInputs.fromAddressLength?.toString() || '0'
        }
    }
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
