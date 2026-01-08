use std::{collections::bounded_vec::BoundedVec, hash::pedersen_hash};
use zkemail::{
    dkim::RSAPubkey, headers::email_address::get_email_address, KEY_LIMBS_2048,
    MAX_EMAIL_ADDRESS_LENGTH, Sequence,
    partial_hash::partial_sha256_var_end,
};

// Maximum remaining header length after partial hash precomputation
// Increased from 512 to 2048 to handle larger From headers while maintaining
// reasonable browser memory usage during proof generation
global MAX_REMAINING_HEADER_LENGTH: u32 = 2048;

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
 * @param remaining_header - Last portion of header containing From field (<=2560 bytes)
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

    // 2. Verify DKIM signature
    //    The RSA signature verifies that the email header hash was signed by the domain's key
    pubkey.verify_dkim_signature_with_hash(header_hash, signature);

    // 3. Extract "From" email address from remaining header
    // Validate sequence parameters first to prevent overflow
    let from_header_index = from_header_sequence.index;
    let from_header_length = from_header_sequence.length;
    let from_address_index = from_address_sequence.index;
    let from_address_length = from_address_sequence.length;
    
    // Bounds checking for header sequence
    assert(from_header_index < remaining_header.len(), "From header index out of bounds");
    assert(from_header_index + from_header_length <= remaining_header.len(), "From header extends beyond remaining header");
    
    // Bounds checking for address sequence  
    assert(from_address_index < remaining_header.len(), "From address index out of bounds");
    assert(from_address_index + from_address_length <= remaining_header.len(), "From address extends beyond remaining header");
    
    // Ensure address is within the header
    assert(from_address_index >= from_header_index, "From address must be within From header");
    assert(from_address_index + from_address_length <= from_header_index + from_header_length, "From address must be within From header bounds");
    
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
    
    // Comprehensive bounds validation to prevent overflow
    assert(addr_len >= min_length, "Address too short for BRACU domain");
    assert(addr_len <= 100, "Address too long for circuit constraints"); // Reasonable max length
    
    // CRITICAL: In Noir, subtraction in witness generation happens before control flow evaluation
    // We must avoid any subtraction that could underflow when index could be 0
    // Solution: Use explicit bounds checking without conditional subtraction
    
    // Ensure we have enough characters for the domain + '@' + at least 1 character before '@'
    assert(addr_len >= BRACU_DOMAIN_LEN + 2, "Address too short for BRACU domain");
    
    // Find the '@' character by checking from the end backwards
    // Start from a safe position that guarantees no underflow
    let safe_start_check = if addr_len > BRACU_DOMAIN_LEN + 1 {
        addr_len - BRACU_DOMAIN_LEN - 1
    } else {
        0
    };
    
    // Validate that we can safely access the domain area
    assert(safe_start_check + BRACU_DOMAIN_LEN + 1 <= addr_len, "Domain area out of bounds");
    assert(safe_start_check < addr_len, "Safe start index out of bounds");
    
    // The '@' character should be at safe_start_check
    let at_char = from_address.get(safe_start_check);
    assert(at_char == 64, "Invalid domain separator - expected '@'"); // 64 is '@'

    // Check domain characters: g.bracu.ac.bd
    let domain_bytes: [u8; 13] = [103, 46, 98, 114, 97, 99, 117, 46, 97, 99, 46, 98, 100];
    
    // Add bounds validation for the loop to prevent overflow
    assert(safe_start_check + 1 + 12 < from_address.len(), "Domain character access out of bounds");
    
    for i in 0..13 {
        let char_index = safe_start_check + 1 + i;
        assert(char_index < from_address.len(), "Domain character index out of bounds");
        let byte_val = from_address.get(char_index);
        assert(byte_val == domain_bytes[i], "Domain mismatch");
    }

    // 5. Generate outputs
    let email_nullifier = pedersen_hash(signature);
    [pubkey.hash(), email_nullifier]
}

