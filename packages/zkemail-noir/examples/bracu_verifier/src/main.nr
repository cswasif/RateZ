use std::{collections::bounded_vec::BoundedVec, hash::pedersen_hash};
use zkemail::{
    dkim::RSAPubkey, headers::email_address::get_email_address, KEY_LIMBS_2048,
    MAX_EMAIL_ADDRESS_LENGTH, Sequence,
};

// Increased header length for real-world emails (standard is 1024-4096)
global MAX_EMAIL_HEADER_LENGTH: u32 = 2560;

// BRACU domain: g.bracu.ac.bd (13 characters)
global BRACU_DOMAIN_LEN: u32 = 13;

/**
 * BRACU Email Domain Verifier
 * 
 * Proves email is from @g.bracu.ac.bd without verifying the body (header-only proof).
 * This significantly reduces circuit size and proving time.
 *
 * @param header - Email header, 0-padded
 * @param pubkey - DKIM RSA Public Key
 * @param signature - DKIM RSA Signature
 * @param from_header_sequence - Index/length of "From" header field
 * @param from_address_sequence - Index/length of the email address within the From header
 * @return - [pubkey_hash, email_nullifier]
 */
fn main(
    header: BoundedVec<u8, MAX_EMAIL_HEADER_LENGTH>,
    pubkey: RSAPubkey<KEY_LIMBS_2048>,
    signature: [Field; KEY_LIMBS_2048],
    from_header_sequence: Sequence,
    from_address_sequence: Sequence,
) -> pub [Field; 2] {
    // 1. Verify DKIM signature over the header
    //    Proves the email integrity and origin (signed by Google/Provider)
    let _ = pubkey.verify_dkim_signature(header, signature);

    // 2. Extract "From" email address
    //    We use "from" tag to locate the address in the header
    let from_tag = comptime { "from".as_bytes() };
    
    // Note: get_email_address returns BoundedVec<u8, MAX_EMAIL_ADDRESS_LENGTH>
    let from_address = get_email_address(
        header,
        from_header_sequence,
        from_address_sequence,
        from_tag
    );

    // 3. Verify domain is @g.bracu.ac.bd
    //    The domain check is hardcoded for g.bracu.ac.bd [103, 46, 98, 114, 97, 99, 117, 46, 97, 99, 46, 98, 100]
    
    let addr_len = from_address.len();
    
    // We expect the address to end with @g.bracu.ac.bd
    // So the character at (len - 13 - 1) should be '@' (64)
    // And the characters from (len - 13) to (len) should match the domain
    
    assert(addr_len > BRACU_DOMAIN_LEN + 1, "Address too short");
    
    let at_index = addr_len - BRACU_DOMAIN_LEN - 1;
    let at_char = from_address.get(at_index);
    assert(at_char == 64, "Invalid domain separator"); // 64 is '@'

    // Check domain characters
    // g.bracu.ac.bd
    let domain_bytes: [u8; 13] = [103, 46, 98, 114, 97, 99, 117, 46, 97, 99, 46, 98, 100];
    
    for i in 0..13 {
        // Use unchecked get since we verified length above
        let byte_val = from_address.get(at_index + 1 + i);
        assert(byte_val == domain_bytes[i], "Domain mismatch");
    }

    // 4. Generate Nullifier
    //    Pedersen hash of the signature ensures uniqueness per email
    //    without revealing the email itself.
    let email_nullifier = pedersen_hash(signature);

    [pubkey.hash(), email_nullifier]
}
