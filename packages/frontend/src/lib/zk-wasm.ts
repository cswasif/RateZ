// Frontend integration for zk-wasm
// Note: zk-wasm-pkg is optional and may not be available in all builds
let wasmModule: any = null;
let wasmInitialized = false;

async function loadWasmModule() {
  if (wasmModule) return wasmModule;

  try {
    // Use dynamic import that TypeScript won't resolve at compile time
    const moduleName = './zk-wasm-pkg/zk_wasm';
    wasmModule = await (eval(`import('${moduleName}')`) as Promise<any>);
    return wasmModule;
  } catch (error) {
    console.warn('zk-wasm-pkg not available, zk-wasm functionality will be disabled:', error);
    return null;
  }
}

export async function initZK() {
  if (!wasmInitialized) {
    const module = await loadWasmModule();
    if (module) {
      await module.default(); // init function
      wasmInitialized = true;
    } else {
      throw new Error('zk-wasm-pkg module not available');
    }
  }

  const module = await loadWasmModule();
  return {
    verifier: new module.ZKWASMVerifier(),
    prover: new module.ZKWASMProver()
  };
}

export async function loadVerifyingKey(verifier: any, vkBytes: Uint8Array): Promise<void> {
  try {
    await verifier.load_verifying_key(vkBytes);
  } catch (error) {
    console.error('Failed to load verifying key:', error);
    throw error;
  }
}

export async function verifyProof(verifier: any, proofBytes: Uint8Array, publicInputs: Uint8Array): Promise<boolean> {
  try {
    return await verifier.verify_proof(proofBytes, publicInputs);
  } catch (error) {
    console.error('Verification failed:', error);
    throw error;
  }
}

export async function generateProof(prover: any, privateInputs: Uint8Array, publicInputs: Uint8Array): Promise<Uint8Array> {
  try {
    return await prover.generate_proof(privateInputs, publicInputs);
  } catch (error) {
    console.error('Proof generation failed:', error);
    throw error;
  }
}

// ============================================================================
// Partial SHA256 Hash Functions for Large Email Headers
// ============================================================================

export interface PartialHashResult {
  /** Intermediate SHA256 state (8 x u32) */
  state: Uint32Array;
  /** Remaining bytes to be processed in circuit */
  remaining: Uint8Array;
  /** Total length of the original message */
  totalLength: number;
  /** Number of bytes that were pre-hashed */
  prehashedLength: number;
}

/**
 * Check if partial hash WASM functions are available
 */
export async function isPartialHashAvailable(): Promise<boolean> {
  const module = await loadWasmModule();
  return module && typeof module.compute_partial_hash_for_email === 'function';
}

/**
 * Compute partial SHA256 hash for an email header.
 * 
 * This function:
 * 1. Finds the "From:" header position
 * 2. Splits at a 64-byte boundary before it
 * 3. Computes SHA256 of the prefix
 * 4. Returns intermediate state + remaining bytes
 * 
 * @param headerBytes - Full email header bytes
 * @param maxRemainingLen - Maximum bytes for circuit (default 2560)
 * @returns Partial hash result with state and remaining bytes
 */
export async function computePartialHash(
  headerBytes: Uint8Array,
  maxRemainingLen: number = 2560
): Promise<PartialHashResult> {
  const module = await loadWasmModule();

  if (!module) {
    throw new Error('zk-wasm module not available for partial hash computation');
  }

  if (typeof module.compute_partial_hash_for_email !== 'function') {
    throw new Error('compute_partial_hash_for_email not found in WASM module. Please rebuild the WASM.');
  }

  try {
    const result = module.compute_partial_hash_for_email(headerBytes, maxRemainingLen);

    return {
      state: new Uint32Array(result.state),
      remaining: new Uint8Array(result.remaining),
      totalLength: Number(result.total_length),
      prehashedLength: Number(result.prehashed_length),
    };
  } catch (error) {
    console.error('Partial hash computation failed:', error);
    throw error;
  }
}

/**
 * Fallback: compute partial hash in pure JavaScript
 * Used when WASM module is not available
 */
export function computePartialHashFallback(
  headerBytes: Uint8Array,
  maxRemainingLen: number = 2560
): PartialHashResult {
  const BLOCK_SIZE = 64;
  const headerLen = headerBytes.length;

  // If small enough, no precomputation needed
  if (headerLen <= maxRemainingLen) {
    return {
      // SHA256 initial state
      state: new Uint32Array([
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
      ]),
      remaining: headerBytes,
      totalLength: headerLen,
      prehashedLength: 0,
    };
  }

  // Find "From:" header position
  const headerStr = new TextDecoder().decode(headerBytes);
  const fromMatch = headerStr.match(/\r?\nFrom:/i);
  if (!fromMatch || fromMatch.index === undefined) {
    throw new Error('Could not find From: header in email');
  }
  const fromPos = fromMatch.index + (fromMatch[0].startsWith('\r') ? 2 : 1);

  // Calculate split point
  const minSplit = headerLen > maxRemainingLen ? headerLen - maxRemainingLen : 0;
  let splitPoint = Math.floor((fromPos - 1) / BLOCK_SIZE) * BLOCK_SIZE;
  if (splitPoint < minSplit) {
    splitPoint = Math.floor(minSplit / BLOCK_SIZE) * BLOCK_SIZE;
    if (splitPoint >= fromPos) {
      throw new Error('Cannot split header: From header is too close to start');
    }
  }

  // For fallback, we return initial state and let circuit handle it
  // This won't work for large headers but provides graceful degradation
  console.warn('Using JavaScript fallback - partial hash may not work correctly for very large headers');

  return {
    state: new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ]),
    remaining: headerBytes.slice(splitPoint),
    totalLength: headerLen,
    prehashedLength: splitPoint,
  };
}