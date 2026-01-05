/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const __wbg_partialhashresult_free: (a: number, b: number) => void;
export const __wbg_zkwasmprover_free: (a: number, b: number) => void;
export const __wbg_zkwasmverifier_free: (a: number, b: number) => void;
export const compute_partial_hash_for_email: (a: number, b: number, c: number) => [number, number, number];
export const generate_proof: (a: number, b: number, c: number, d: number, e: number, f: number, g: any) => [number, number, number];
export const init: () => void;
export const partialhashresult_prehashed_length: (a: number) => bigint;
export const partialhashresult_remaining: (a: number) => [number, number];
export const partialhashresult_state: (a: number) => [number, number];
export const partialhashresult_total_length: (a: number) => bigint;
export const verify_proof: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
export const zkwasmprover_generate_proof: (a: number, b: any) => [number, number, number];
export const zkwasmprover_load_circuit: (a: number, b: number, c: number, d: number, e: number) => [number, number];
export const zkwasmprover_load_proving_key: (a: number, b: number, c: number) => [number, number];
export const zkwasmprover_new: () => number;
export const zkwasmverifier_load_verifying_key: (a: number, b: number, c: number) => [number, number];
export const zkwasmverifier_new: () => number;
export const zkwasmverifier_verify_proof: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __wbindgen_exn_store: (a: number) => void;
export const __externref_table_alloc: () => number;
export const __wbindgen_externrefs: WebAssembly.Table;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __externref_table_dealloc: (a: number) => void;
export const __wbindgen_start: () => void;
