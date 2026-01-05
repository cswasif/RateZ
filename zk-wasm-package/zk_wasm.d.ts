/* tslint:disable */
/* eslint-disable */

export class PartialHashResult {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  readonly total_length: bigint;
  readonly prehashed_length: bigint;
  readonly state: Uint32Array;
  readonly remaining: Uint8Array;
}

export class ZKWASMProver {
  free(): void;
  [Symbol.dispose](): void;
  load_circuit(_wasm_bytes: Uint8Array, _r1cs_bytes: Uint8Array): void;
  generate_proof(inputs: any): any;
  load_proving_key(pk_bytes: Uint8Array): void;
  constructor();
}

export class ZKWASMVerifier {
  free(): void;
  [Symbol.dispose](): void;
  verify_proof(proof_bytes: Uint8Array, public_inputs: Uint8Array): boolean;
  load_verifying_key(vk_bytes: Uint8Array): void;
  constructor();
}

/**
 * Compute partial SHA256 hash state for email header precomputation.
 * 
 * This function:
 * 1. Finds the "From:" header position in the email
 * 2. Calculates a split point before the From header at a 64-byte boundary
 * 3. Computes SHA256 of the prefix blocks
 * 4. Returns the intermediate state + remaining bytes
 *
 * # Arguments
 * * `header_bytes` - Full email header bytes
 * * `max_remaining_len` - Maximum bytes for circuit (e.g., 2560)
 *
 * # Returns
 * PartialHashResult with intermediate state and remaining bytes
 */
export function compute_partial_hash_for_email(header_bytes: Uint8Array, max_remaining_len: number): PartialHashResult;

export function generate_proof(_r1cs_bytes: Uint8Array, _wasm_bytes: Uint8Array, _zkey_bytes: Uint8Array, _inputs: any): any;

export function init(): void;

export function verify_proof(_vk_bytes: Uint8Array, _proof_bytes: Uint8Array, _public_signals: Uint8Array): boolean;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_partialhashresult_free: (a: number, b: number) => void;
  readonly __wbg_zkwasmprover_free: (a: number, b: number) => void;
  readonly __wbg_zkwasmverifier_free: (a: number, b: number) => void;
  readonly compute_partial_hash_for_email: (a: number, b: number, c: number) => [number, number, number];
  readonly generate_proof: (a: number, b: number, c: number, d: number, e: number, f: number, g: any) => [number, number, number];
  readonly init: () => void;
  readonly partialhashresult_prehashed_length: (a: number) => bigint;
  readonly partialhashresult_remaining: (a: number) => [number, number];
  readonly partialhashresult_state: (a: number) => [number, number];
  readonly partialhashresult_total_length: (a: number) => bigint;
  readonly verify_proof: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly zkwasmprover_generate_proof: (a: number, b: any) => [number, number, number];
  readonly zkwasmprover_load_circuit: (a: number, b: number, c: number, d: number, e: number) => [number, number];
  readonly zkwasmprover_load_proving_key: (a: number, b: number, c: number) => [number, number];
  readonly zkwasmprover_new: () => number;
  readonly zkwasmverifier_load_verifying_key: (a: number, b: number, c: number) => [number, number];
  readonly zkwasmverifier_new: () => number;
  readonly zkwasmverifier_verify_proof: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
