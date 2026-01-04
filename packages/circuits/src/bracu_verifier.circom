pragma circom 2.1.5;

include "@zk-email/circuits/email-verifier.circom";
include "./bracu_regex.circom";

template BracuVerifier(max_header_bytes, max_body_bytes, n, k, pack_size) {
    signal input in_padded[max_header_bytes]; // Preprocessed email header
    signal input pubkey[k];                   // RSA Public Key (Google)
    signal input signature[k];                // RSA Signature
    signal input in_len_padded_bytes;         // Length of padded header

    // Outputs
    signal output pubkey_hash;
    signal output nullifier;

    // 1. Core Email Verification (DKIM)
    component emailVerifier = EmailVerifier(max_header_bytes, max_body_bytes, n, k, 0);
    emailVerifier.in_padded <== in_padded;
    emailVerifier.pubkey <== pubkey;
    emailVerifier.signature <== signature;
    emailVerifier.in_len_padded_bytes <== in_len_padded_bytes;

    // 2. Domain Verification (@g.bracu.ac.bd)
    // The regex circuit will be generated to match: "from:.*@g.bracu.ac.bd"
    // and expose the match signal
    component regex = BracuRegex(max_header_bytes);
    regex.msg <== in_padded;
    
    // Ensure the regex matched
    regex.out === 1;

    // 3. Nullifier Generation
    // We use the email signature as the base for the nullifier to ensure uniqueness
    // but preventing linkability (since signature is unique per email)
    // Note: In a real voting system, we might hash (signature + external_nullifier)
    nullifier <== emailVerifier.pubkey_hash; // Placeholder: Real logic needs Poseidon(signature)
}

// Main component with standard sizes
// RSA-2048 (121 * 17)
component main = BracuVerifier(1024, 0, 121, 17, 7);
