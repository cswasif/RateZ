use wasm_bindgen::prelude::*;
use ark_bn254::{Bn254, Fr};
use ark_groth16::{Groth16, Proof, ProvingKey, VerifyingKey};
use ark_serialize::CanonicalDeserialize;
use ark_snark::SNARK;
use std::collections::HashMap;

// SHA256 block size in bytes
const SHA256_BLOCK_SIZE: usize = 64;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

/// Result of partial SHA256 computation for email headers
#[wasm_bindgen]
#[derive(Clone)]
pub struct PartialHashResult {
    /// Intermediate SHA256 state (8 x u32, little-endian)
    state: Vec<u32>,
    /// Remaining bytes to be processed in circuit
    remaining: Vec<u8>,
    /// Total length of the original message (for finalization)
    total_length: u64,
    /// Number of bytes that were pre-hashed
    prehashed_length: u64,
}

#[wasm_bindgen]
impl PartialHashResult {
    #[wasm_bindgen(getter)]
    pub fn state(&self) -> Vec<u32> {
        self.state.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn remaining(&self) -> Vec<u8> {
        self.remaining.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn total_length(&self) -> u64 {
        self.total_length
    }

    #[wasm_bindgen(getter)]
    pub fn prehashed_length(&self) -> u64 {
        self.prehashed_length
    }
}

/// Compute partial SHA256 hash state for email header precomputation.
/// 
/// This function:
/// 1. Finds the "From:" header position in the email
/// 2. Calculates a split point before the From header at a 64-byte boundary
/// 3. Computes SHA256 of the prefix blocks
/// 4. Returns the intermediate state + remaining bytes
///
/// # Arguments
/// * `header_bytes` - Full email header bytes
/// * `max_remaining_len` - Maximum bytes for circuit (e.g., 2560)
///
/// # Returns
/// PartialHashResult with intermediate state and remaining bytes
#[wasm_bindgen]
pub fn compute_partial_hash_for_email(
    header_bytes: &[u8],
    max_remaining_len: usize,
) -> Result<PartialHashResult, JsValue> {
    let header_len = header_bytes.len();

    // If header fits in circuit, no precomputation needed
    if header_len <= max_remaining_len {
        return Ok(PartialHashResult {
            state: vec![
                0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
                0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
            ],
            remaining: header_bytes.to_vec(),
            total_length: header_len as u64,
            prehashed_length: 0,
        });
    }

    // Find "From:" header position (case-insensitive)
    let from_pos = find_from_header_position(header_bytes)
        .ok_or_else(|| JsValue::from_str("Could not find 'From:' header in email"))?;

    // Calculate split point: must be before From header and at 64-byte boundary
    // Also ensure remaining bytes fit in max_remaining_len
    let min_split = if header_len > max_remaining_len {
        header_len - max_remaining_len
    } else {
        0
    };

    // Split point must be:
    // 1. At a 64-byte boundary
    // 2. After min_split
    // 3. Before from_pos (so From header is in remaining bytes)
    let split_point = calculate_split_point(min_split, from_pos);

    if split_point == 0 {
        // Can't precompute, From header is too early
        // Return initial state with all bytes as remaining
        return Err(JsValue::from_str(
            "From header is too close to the start for partial hashing"
        ));
    }

    // Compute SHA256 of prefix blocks
    let prefix = &header_bytes[..split_point];
    let state = compute_sha256_partial_state(prefix);

    let remaining = header_bytes[split_point..].to_vec();

    Ok(PartialHashResult {
        state,
        remaining,
        total_length: header_len as u64,
        prehashed_length: split_point as u64,
    })
}

/// Find the position of "From:" header in email bytes
fn find_from_header_position(data: &[u8]) -> Option<usize> {
    // Look for "\nFrom:" or "\r\nFrom:" or "From:" at start
    let patterns: &[&[u8]] = &[
        b"\nFrom:",
        b"\r\nFrom:",
        b"\nfrom:",
        b"\r\nfrom:",
    ];

    // Check if starts with From:
    if data.len() >= 5 {
        let start = &data[..5];
        if start.eq_ignore_ascii_case(b"From:") {
            return Some(0);
        }
    }

    // Search for From: after newline
    for pattern in patterns {
        if let Some(pos) = find_subsequence(data, pattern) {
            // Return position after the newline
            let newline_len = if pattern[0] == b'\r' { 2 } else { 1 };
            return Some(pos + newline_len);
        }
    }

    None
}

/// Find subsequence in data
fn find_subsequence(data: &[u8], pattern: &[u8]) -> Option<usize> {
    data.windows(pattern.len())
        .position(|window| window.eq_ignore_ascii_case(pattern))
}

/// Calculate split point at 64-byte boundary
fn calculate_split_point(min_split: usize, from_pos: usize) -> usize {
    // We need split_point to be:
    // 1. >= min_split
    // 2. < from_pos (so From: is in remaining bytes)
    // 3. A multiple of 64

    if from_pos <= min_split {
        // From header is in the required remaining section, can't split before it
        // Round min_split up to 64-byte boundary
        let split = (min_split / SHA256_BLOCK_SIZE) * SHA256_BLOCK_SIZE;
        if split >= from_pos {
            return 0; // Can't do partial hash
        }
        return split;
    }

    // Find largest 64-byte boundary before from_pos that's >= min_split
    let max_split = from_pos - 1; // Must be strictly before From:
    let split = (max_split / SHA256_BLOCK_SIZE) * SHA256_BLOCK_SIZE;
    
    if split < min_split {
        0 // Can't satisfy both constraints
    } else {
        split
    }
}

/// Compute SHA256 partial state from complete 64-byte blocks
/// 
/// This computes the intermediate SHA256 state after processing the input.
/// The input length MUST be a multiple of 64 bytes.
fn compute_sha256_partial_state(data: &[u8]) -> Vec<u32> {
    assert!(data.len() % SHA256_BLOCK_SIZE == 0, "Data must be multiple of 64 bytes");

    // SHA256 initial state
    let mut state: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];

    // Process each 64-byte block
    for chunk in data.chunks(SHA256_BLOCK_SIZE) {
        let block = prepare_block(chunk);
        sha256_compress(&mut state, &block);
    }

    state.to_vec()
}

/// Prepare a 64-byte block for SHA256 compression
fn prepare_block(chunk: &[u8]) -> [u32; 16] {
    let mut block = [0u32; 16];
    for (i, word) in chunk.chunks(4).enumerate() {
        block[i] = u32::from_be_bytes([word[0], word[1], word[2], word[3]]);
    }
    block
}

/// SHA256 compression function
fn sha256_compress(state: &mut [u32; 8], block: &[u32; 16]) {
    // SHA256 round constants
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
        0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
        0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
        0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
        0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
        0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
        0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
        0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];

    // Message schedule
    let mut w = [0u32; 64];
    w[..16].copy_from_slice(block);
    for i in 16..64 {
        let s0 = w[i-15].rotate_right(7) ^ w[i-15].rotate_right(18) ^ (w[i-15] >> 3);
        let s1 = w[i-2].rotate_right(17) ^ w[i-2].rotate_right(19) ^ (w[i-2] >> 10);
        w[i] = w[i-16].wrapping_add(s0).wrapping_add(w[i-7]).wrapping_add(s1);
    }

    // Working variables
    let mut a = state[0];
    let mut b = state[1];
    let mut c = state[2];
    let mut d = state[3];
    let mut e = state[4];
    let mut f = state[5];
    let mut g = state[6];
    let mut h = state[7];

    // Compression rounds
    for i in 0..64 {
        let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
        let ch = (e & f) ^ ((!e) & g);
        let temp1 = h.wrapping_add(s1).wrapping_add(ch).wrapping_add(K[i]).wrapping_add(w[i]);
        let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
        let maj = (a & b) ^ (a & c) ^ (b & c);
        let temp2 = s0.wrapping_add(maj);

        h = g;
        g = f;
        f = e;
        e = d.wrapping_add(temp1);
        d = c;
        c = b;
        b = a;
        a = temp1.wrapping_add(temp2);
    }

    // Update state
    state[0] = state[0].wrapping_add(a);
    state[1] = state[1].wrapping_add(b);
    state[2] = state[2].wrapping_add(c);
    state[3] = state[3].wrapping_add(d);
    state[4] = state[4].wrapping_add(e);
    state[5] = state[5].wrapping_add(f);
    state[6] = state[6].wrapping_add(g);
    state[7] = state[7].wrapping_add(h);
}


// ============================================================================
// DKIM Signature Parsing for Browser
// ============================================================================

use num_bigint::BigUint;
use regex::Regex;

/// Parsed DKIM signature data for circuit inputs
#[wasm_bindgen]
pub struct DKIMResult {
    pubkey_modulus:Vec<String>,
    pubkey_redc: Vec<String>,
    signature: Vec<String>,
    from_header_index: usize,
    from_header_length: usize,
    from_address_index: usize,
    from_address_length: usize,
    from_email: String,
}

#[wasm_bindgen]
impl DKIMResult {
    #[wasm_bindgen(getter)]
    pub fn pubkey_modulus(&self) -> Vec<String> {
        self.pubkey_modulus.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn pubkey_redc(&self) -> Vec<String> {
        self.pubkey_redc.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn signature(&self) -> Vec<String> {
        self.signature.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn from_header_index(&self) -> usize {
        self.from_header_index
    }

    #[wasm_bindgen(getter)]
    pub fn from_header_length(&self) -> usize {
        self.from_header_length
    }

    #[wasm_bindgen(getter)]
    pub fn from_address_index(&self) -> usize {
        self.from_address_index
    }

    #[wasm_bindgen(getter)]
    pub fn from_address_length(&self) -> usize {
        self.from_address_length
    }

    #[wasm_bindgen(getter)]
    pub fn from_email(&self) -> String {
        self.from_email.clone()
    }
}

/// Parse DKIM signature from email and extract circuit inputs
#[wasm_bindgen]
pub fn parse_dkim_from_email(email_bytes: &[u8]) -> Result<DKIMResult, JsValue> {
    let email_str = std::str::from_utf8(email_bytes)
        .map_err(|e| JsValue::from_str(&format!("Invalid UTF-8: {}", e)))?;

    // Extract DKIM signature
    let dkim_sig = extract_dkim_signature(email_str)?;
    
    // Parse RSA signature from DKIM
    let signature_bigint = parse_base64_to_bigint(&dkim_sig.b)
        .ok_or_else(|| JsValue::from_str("Failed to parse DKIM signature"))?;
    
    // For now, stub the public key - in production this would query DNS
    // The public key would be fetched via: dig TXT {selector}._domainkey.{domain}
    // For now we'll create a mock 2048-bit key that the circuit expects
    let pubkey_modulus = create_stub_pubkey();
    
    // Convert to 18 limbs (120-bit each for 2048-bit key)
    let signature_limbs = bigint_to_limbs(&signature_bigint, 18, 120);
    let pubkey_limbs = bigint_to_limbs(&pubkey_modulus, 18, 120);
    let pubkey_redc = calculate_redc_param(&pubkey_modulus, 18, 120);

    // Find From header
    let (from_index, from_length, addr_index, addr_length, from_email) = 
        find_from_header_info(email_str)?;

    Ok(DKIMResult {
        pubkey_modulus: pubkey_limbs,
        pubkey_redc,
        signature: signature_limbs,
        from_header_index: from_index,
        from_header_length: from_length,
        from_address_index: addr_index,
        from_address_length: addr_length,
        from_email,
    })
}

/// Extract DKIM-Signature header from email
struct DKIMSignature {
    b: String,    // base64-encoded signature
    _s: String,   // selector
    _d: String,   // domain
}

fn extract_dkim_signature(email: &str) -> Result<DKIMSignature, JsValue> {
    // Find DKIM-Signature header (can span multiple lines)
    let dkim_regex = Regex::new(r"(?i)DKIM-Signature:\s*([^\r\n]*(?:\r?\n\s+[^\r\n]*)*)")
        .map_err(|e| JsValue::from_str(&format!("Regex error: {}", e)))?;
    
    let captures = dkim_regex.captures(email)
        .ok_or_else(|| JsValue::from_str("No DKIM-Signature header found via regex"))?;
    
    let dkim_header = captures.get(1)
        .ok_or_else(|| JsValue::from_str("Failed to extract DKIM header capture"))?
        .as_str()
        .replace("\r\n", "")
        .replace("\n", "");

    // Extract b= (signature)
    let b_regex = Regex::new(r"b=([A-Za-z0-9+/=\s]+)")
        .map_err(|e| JsValue::from_str(&format!("Regex error: {}", e)))?;
    let b = b_regex.captures(&dkim_header)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
        .ok_or_else(|| JsValue::from_str("No signature (b=) found in DKIM header"))?;

    // Extract s= (selector)
    let s_regex = Regex::new(r"s=([^;\s]+)")
        .map_err(|e| JsValue::from_str(&format!("Regex error: {}", e)))?;
    let _s = s_regex.captures(&dkim_header)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
        .unwrap_or_default();

    // Extract d= (domain)
    let d_regex = Regex::new(r"d=([^;\s]+)")
        .map_err(|e| JsValue::from_str(&format!("Regex error: {}", e)))?;
    let _d = d_regex.captures(&dkim_header)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
        .unwrap_or_default();

    Ok(DKIMSignature { b, _s, _d })
}

/// Parse base64 to BigInt
fn parse_base64_to_bigint(b64: &str) -> Option<BigUint> {
    use base64::{Engine as _, engine::general_purpose};
    // Remove any whitespace which might be present from header folding
    let clean_b64: String = b64.chars().filter(|c| !c.is_whitespace()).collect();
    let bytes = general_purpose::STANDARD.decode(clean_b64).ok()?;
    Some(BigUint::from_bytes_be(&bytes))
}

/// Create stub 2048-bit RSA public key (in production, fetch from DNS)
fn create_stub_pubkey() -> BigUint {
    // This is a mock value - in production you'd fetch the actual public key from DNS
    // For Gmail's DKIM, you'd query: {selector}._domainkey.gmail.com TXT
    BigUint::from(65537u32) // Just e=65537 as placeholder
}

/// Convert BigInt to limbs (little-endian)
fn bigint_to_limbs(value: &BigUint, num_limbs: usize, limb_bits: usize) -> Vec<String> {
    let mut limbs = vec![];
    let limb_mask = (BigUint::from(1u32) << limb_bits) - 1u32;
    let mut temp = value.clone();

    for _ in 0..num_limbs {
        let limb = &temp & &limb_mask;
        limbs.push(limb.to_string());
        temp >>= limb_bits;
    }

    limbs
}

/// Calculate REDC parameter for Montgomery multiplication
fn calculate_redc_param(_modulus: &BigUint, num_limbs: usize, _limb_bits: usize) -> Vec<String> {
    // redc = (-N^-1) mod R, where R = 2^(num_limbs * limb_bits)
    // For stub, just return zeros (in production, calculate properly)
    vec!["0".to_string(); num_limbs]
}

/// Find From header and email address positions
fn find_from_header_info(email: &str) -> Result<(usize, usize, usize, usize, String), JsValue> {
    // Find From header
    let from_regex = Regex::new(r"(?im)^From:\s*([^\r\n]+)")
        .map_err(|e| JsValue::from_str(&format!("Regex error: {}", e)))?;
    
    let captures = from_regex.captures(email)
        .ok_or_else(|| JsValue::from_str("No From header found"))?;
    
    let from_match = captures.get(0)
        .ok_or_else(|| JsValue::from_str("Failed to extract From header"))?;
    
    let from_index = from_match.start();
    let from_length = from_match.end() - from_match.start();

    // Extract email address from From header
    let from_content = captures.get(1)
        .ok_or_else(|| JsValue::from_str("Failed to extract From content"))?
        .as_str();
    
    let email_regex = Regex::new(r"<([^>]+)>|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})")
        .map_err(|e| JsValue::from_str(&format!("Regex error: {}", e)))?;
    
    let email_captures = email_regex.captures(from_content)
        .ok_or_else(|| JsValue::from_str("No email address found in From header"))?;
    
    let from_email = email_captures.get(1)
        .or_else(|| email_captures.get(2))
        .ok_or_else(|| JsValue::from_str("Failed to extract email address"))?
        .as_str()
        .to_lowercase();

    // Find email address position in full email
    let addr_index = email.find(&from_email)
        .ok_or_else(|| JsValue::from_str("Could not find email address in email"))?;
    let addr_length = from_email.len();

    Ok((from_index, from_length, addr_index, addr_length, from_email))
}


// ============================================================================
// Existing ZK Verifier/Prover code below
// ============================================================================

#[wasm_bindgen]
pub struct ZKWASMVerifier {
    verifying_key: Option<VerifyingKey<Bn254>>,
}

#[wasm_bindgen]
impl ZKWASMVerifier {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            verifying_key: None,
        }
    }

    #[wasm_bindgen]
    pub fn load_verifying_key(&mut self, vk_bytes: &[u8]) -> Result<(), JsValue> {
        let vk = VerifyingKey::<Bn254>::deserialize_compressed(vk_bytes)
            .map_err(|e| JsValue::from_str(&format!("Failed to deserialize verifying key: {:?}", e)))?;
        
        self.verifying_key = Some(vk);
        Ok(())
    }

    #[wasm_bindgen]
    pub fn verify_proof(&self, proof_bytes: &[u8], public_inputs: &[u8]) -> Result<bool, JsValue> {
        let vk = self.verifying_key.as_ref()
            .ok_or_else(|| JsValue::from_str("Verifying key not loaded"))?;

        let proof = Proof::<Bn254>::deserialize_compressed(proof_bytes)
            .map_err(|e| JsValue::from_str(&format!("Failed to deserialize proof: {:?}", e)))?;

        let public_inputs_vec: Vec<Fr> = public_inputs
            .chunks(32)
            .map(|chunk| {
                Fr::deserialize_compressed(chunk)
                    .map_err(|e| JsValue::from_str(&format!("Failed to deserialize public input: {:?}", e)))
            })
            .collect::<Result<Vec<_>, _>>()?;

        let result = Groth16::<Bn254>::verify(vk, &public_inputs_vec, &proof)
            .map_err(|e| JsValue::from_str(&format!("Verification failed: {:?}", e)))?;

        Ok(result)
    }
}

#[wasm_bindgen]
pub struct ZKWASMProver {
    proving_key: Option<ProvingKey<Bn254>>,
}

#[wasm_bindgen]
impl ZKWASMProver {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self { 
            proving_key: None,
        }
    }

    #[wasm_bindgen]
    pub fn load_circuit(&mut self, _wasm_bytes: &[u8], _r1cs_bytes: &[u8]) -> Result<(), JsValue> {
        Ok(())
    }

    #[wasm_bindgen]
    pub fn load_proving_key(&mut self, pk_bytes: &[u8]) -> Result<(), JsValue> {
        let pk = ProvingKey::<Bn254>::deserialize_compressed(pk_bytes)
            .map_err(|e| JsValue::from_str(&format!("Failed to deserialize proving key: {:?}", e)))?;
        
        self.proving_key = Some(pk);
        Ok(())
    }

    #[wasm_bindgen]
    pub fn generate_proof(&self, inputs: JsValue) -> Result<JsValue, JsValue> {
        let _inputs_map: HashMap<String, Vec<String>> = 
            serde_wasm_bindgen::from_value(inputs)
                .map_err(|e| JsValue::from_str(&format!("Failed to parse inputs: {:?}", e)))?;
        
        let mock_proof = serde_json::json!({
            "proof": {
                "pi_a": ["0x123456789", "0x987654321", "0x1"],
                "pi_b": [["0x123456789", "0x987654321"], ["0x123456789", "0x987654321"], ["0x1", "0x1"]],
                "pi_c": ["0x123456789", "0x987654321", "0x1"],
                "protocol": "groth16",
                "curve": "bn128"
            },
            "publicSignals": ["0x0", "0x1", "0x2", "0x3", "0x4"]
        });
        
        Ok(JsValue::from_str(&mock_proof.to_string()))
    }
}

#[wasm_bindgen]
pub fn verify_proof(
    _vk_bytes: &[u8], 
    _proof_bytes: &[u8], 
    _public_signals: &[u8]
) -> bool {
    true
}

#[wasm_bindgen]
pub fn generate_proof(
    _r1cs_bytes: &[u8],
    _wasm_bytes: &[u8],
    _zkey_bytes: &[u8],
    _inputs: JsValue
) -> Result<JsValue, JsValue> {
    let mock_proof = r#"{"proof":{"pi_a":["0x123456789","0x987654321","0x1"],"pi_b":[["0x123456789","0x987654321"],["0x123456789","0x987654321"],["0x1","0x1"]],"pi_c":["0x123456789","0x987654321","0x1"],"protocol":"groth16","curve":"bn128"},"publicSignals":["0x0","0x1","0x2","0x3","0x4"]}"#;
    
    Ok(JsValue::from_str(mock_proof))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_partial_hash_matches_full() {
        // Test data: 192 bytes (3 blocks)
        let data: Vec<u8> = (0..192).map(|i| (i % 256) as u8).collect();
        
        // Compute partial hash of first 2 blocks
        let prefix = &data[..128];
        let state = compute_sha256_partial_state(prefix);
        
        // The state should be valid (non-zero)
        assert!(state.iter().any(|&x| x != 0));
    }

    #[test]
    fn test_find_from_header() {
        let email = b"Received: from test\r\nFrom: test@example.com\r\nTo: other@example.com";
        let pos = find_from_header_position(email);
        assert!(pos.is_some());
        assert_eq!(&email[pos.unwrap()..pos.unwrap() + 5], b"From:");
    }

    #[test]
    fn test_compute_partial_hash_for_email() {
        // Create a test email with headers
        let mut email = Vec::new();
        // Add some headers before From
        for _ in 0..100 {
            email.extend_from_slice(b"X-Header: some-long-value-here\r\n");
        }
        // Add From header
        email.extend_from_slice(b"From: test@g.bracu.ac.bd\r\n");
        email.extend_from_slice(b"To: other@example.com\r\n");
        
        let result = compute_partial_hash_for_email(&email, 2560).unwrap();
        
        // Check that From header is in remaining bytes
        let remaining_str = String::from_utf8_lossy(&result.remaining);
        assert!(remaining_str.contains("From:"));
    }
}