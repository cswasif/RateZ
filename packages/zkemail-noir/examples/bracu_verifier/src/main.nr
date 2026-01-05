use std::{collections::bounded_vec::BoundedVec, hash::pedersen_hash};
use zkemail::{
    dkim::RSAPubkey, headers::email_address::get_email_address, KEY_LIMBS_2048,
    MAX_EMAIL_ADDRESS_LENGTH, Sequence,
    partial_hash::partial_sha256_var_end,
};
use bignum::{params::BigNumParams, RuntimeBigNum};
use rsa::{rsa::verify_sha256_pkcs1v15, types::RBN2048};

// Maximum remaining header length after partial hash precomputation
global MAX_REMAINING_HEADER_LENGTH: u32 = 2560;

// BRACU domain: g.bracu.ac.bd (13 characters)
global BRACU_DOMAIN_LEN: u32 = 13;

// RSA exponent for DKIM verification
global RSA_EXPONENT: u32 = 65537;

/**
 * BRACU Email Domain Verifier with Partial Hash Support
 * 
 * Proves email is from @g.bracu.ac.bd using partial SHA256 precomputation.
 * This allows verification of emails with headers of ANY size, while keeping
 * the circuit size fixed at ~2560 bytes.
 *
 * The caller precomputes SHA256 state for header blocks before the From header
 * using the Rust WASM module, then this circuit:
 * 1. Completes the SHA256 hash using the precomputed state
 * 2. Verifies the DKIM RSA signature
 * 3. Extracts and validates the From email domain
 *
 * @param partial_header_hash - Precomputed SHA256 state (8 x u32) from WASM
 * @param remaining_header - Last portion of header containing From field (≤2560 bytes)
 * @param total_header_length - Full original header length (for SHA256 finalization)
 * @param pubkey - DKIM RSA Public Key
 * @param signature - DKIM RSA Signature
 * @param from_header_sequence - Index/length of "From" header field within remaining_header
 * @param from_address_sequence - Index/length of email address within From header
 * @return - [pubkey_hash, email_nullifier]
 */
fn main(
    partial_header_hash: [u32; 8],
    remaining_header: BoundedVec<u8, MAX_REMAINING_HEADER_LENGTH>,
    total_header_length: u64,
    pubkey: RSAPubkey<KEY_LIMBS_2048>,
    signature: [Field; KEY_LIMBS_2048],
    from_header_sequence: Sequence,
    from_address_sequence: Sequence,
) -> pub [Field; 2] {
    // 1. Complete the SHA256 hash
    //    Combines precomputed state with remaining bytes to get full header hash
    let header_hash = partial_sha256_var_end(
        partial_header_hash,
        remaining_header.storage(),
        remaining_header.len() as u64,
        total_header_length
    );

    // 2. Verify DKIM signature over the completed hash
    //    This proves the email integrity - it was signed by the DKIM key
    let params: BigNumParams<KEY_LIMBS_2048, 2048> = BigNumParams::new(
        false,
        convert_field_to_u128(pubkey.modulus),
        convert_field_to_u128(pubkey.redc),
    );
    let sig: RBN2048 = RuntimeBigNum::from_array(params, convert_field_to_u128(signature));
    sig.validate_in_range();
    assert(verify_sha256_pkcs1v15(header_hash, sig, RSA_EXPONENT), "DKIM signature verification failed");

    // 3. Extract "From" email address from remaining header
    let from_tag = comptime { "from".as_bytes() };
    let from_address = get_email_address(
        remaining_header,
        from_header_sequence,
        from_address_sequence,
        from_tag
    );

    // 4. Verify domain is @g.bracu.ac.bd
    let addr_len = from_address.len();
    let min_length = BRACU_DOMAIN_LEN + 2; // 15 (1 char + '@' + 13 char domain)
    
    // Safe calculation to avoid underflow
    let is_valid_length = addr_len >= min_length;
    let safe_len = if is_valid_length { addr_len } else { min_length };
    let at_index = safe_len - BRACU_DOMAIN_LEN - 1;
    
    assert(is_valid_length, "Address too short for BRACU domain");
    
    let at_char = from_address.get(at_index);
    assert(at_char == 64, "Invalid domain separator - expected '@'"); // 64 is '@'

    // Check domain characters: g.bracu.ac.bd
    let domain_bytes: [u8; 13] = [103, 46, 98, 114, 97, 99, 117, 46, 97, 99, 46, 98, 100];
    for i in 0..13 {
        let byte_val = from_address.get(at_index + 1 + i);
        assert(byte_val == domain_bytes[i], "Domain mismatch");
    }

    // 5. Generate outputs
    let email_nullifier = pedersen_hash(signature);
    [pubkey.hash(), email_nullifier]
}

// Helper: convert Field array to u128 array
fn convert_field_to_u128<let KEY_LIMBS: u32>(arr: [Field; KEY_LIMBS]) -> [u128; KEY_LIMBS] {
    let mut result: [u128; KEY_LIMBS] = [0; KEY_LIMBS];
    for i in 0..KEY_LIMBS {
        result[i] = arr[i] as u128;
    }
    result
}

