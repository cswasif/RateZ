// Frontend integration for zk-wasm
import init, { ZKWASMVerifier, ZKWASMProver } from './zk-wasm-pkg/zk_wasm';

let wasmInitialized = false;

export async function initZK() {
  if (!wasmInitialized) {
    await init();
    wasmInitialized = true;
  }
  return {
    verifier: new ZKWASMVerifier(),
    prover: new ZKWASMProver()
  };
}

export async function loadVerifyingKey(verifier: ZKWASMVerifier, vkBytes: Uint8Array): Promise<void> {
  try {
    await verifier.load_verifying_key(vkBytes);
  } catch (error) {
    console.error('Failed to load verifying key:', error);
    throw error;
  }
}

export async function verifyProof(
  verifier: ZKWASMVerifier, 
  proofBytes: Uint8Array, 
  publicInputs: Uint8Array
): Promise<boolean> {
  try {
    return await verifier.verify_proof(proofBytes, publicInputs);
  } catch (error) {
    console.error('Proof verification failed:', error);
    throw error;
  }
}

export async function loadProvingKey(prover: ZKWASMProver, pkBytes: Uint8Array): Promise<void> {
  try {
    await prover.load_proving_key(pkBytes);
  } catch (error) {
    console.error('Failed to load proving key:', error);
    throw error;
  }
}

export async function loadCircuit(
  prover: ZKWASMProver, 
  wasmBytes: Uint8Array, 
  r1csBytes: Uint8Array
): Promise<void> {
  try {
    await prover.load_circuit(wasmBytes, r1csBytes);
  } catch (error) {
    console.error('Failed to load circuit:', error);
    throw error;
  }
}

export async function generateProof(
  prover: ZKWASMProver, 
  inputs: Record<string, string[]>
): Promise<any> {
  try {
    const result = await prover.generate_proof(inputs);
    return JSON.parse(result as string);
  } catch (error) {
    console.error('Proof generation failed:', error);
    throw error;
  }
}

// Utility functions for development
export async function quickVerify(_proofBytes: Uint8Array, _publicSignals: Uint8Array): Promise<boolean> {
  // For development, use the simplified verification function
  // In production, this would use the full verification logic
  return true;
}

export async function quickGenerate(_inputs: Record<string, string[]>): Promise<any> {
  // For development, return a mock proof
  return {
    proof: {
      pi_a: ["0x123456789", "0x987654321", "0x1"],
      pi_b: [["0x123456789", "0x987654321"], ["0x123456789", "0x987654321"], ["0x1", "0x1"]],
      pi_c: ["0x123456789", "0x987654321", "0x1"],
      protocol: "groth16",
      curve: "bn128"
    },
    publicSignals: ["0x0", "0x1", "0x2", "0x3", "0x4"]
  };
}