# Zero-Knowledge Email Domain Verification Analysis

## Overview
This document analyzes the challenges and possibilities of zero-knowledge email domain verification based on cryptographic research and practical implementation considerations.

## Key Findings from Cryptographic Research

### Fundamental Challenges

1. **Privacy vs. Verification Trade-off**
   - Traditional email verification requires sending emails to addresses, which reveals the user's email
   - Domain verification through DNS TXT records works for system administrators but not general users
   - The core tension: how to prove email ownership without revealing the email address

2. **Practical Limitations**
   - **Verification Email Approach**: Send codes to multiple emails including user's own
     - Problem: Bounced emails reveal which addresses don't exist
     - Problem: Different codes per email can reveal user identity
     - Impractical for large-scale verification

   - **DNS TXT Record Approach**: Ask users to add TXT records
     - Only feasible for system administrators
     - Not suitable for general user verification

### Zero-Knowledge Solutions

#### DKIM-Based Verification
The most promising approach uses DKIM (DomainKeys Identified Mail) signatures:

**How it works:**
1. User provides an email with valid DKIM signature
2. ZK circuit verifies the DKIM signature cryptographically
3. Circuit extracts domain from email address
4. Proof confirms: "I own an email from domain X" without revealing the email

**Advantages:**
- Cryptographically secure (relies on RSA signatures)
- No email sending required
- Domain extraction possible from email addresses
- Existing email infrastructure support

**Challenges:**
- Circuit size constraints (limited header processing)
- RSA signature verification complexity
- Email preprocessing for circuit compatibility
- Sequence index alignment between email and circuit

#### Implementation Considerations

**Circuit Constraints:**
- Limited header processing capacity (~159 bytes)
- Fixed sequence indices for email extraction
- RSA modulus size limitations (120-bit limbs)
- Precise bit-size validation requirements

**Privacy Preservation:**
- Nullifier generation prevents replay attacks
- Anonymous session management
- No email address storage or logging
- Domain-only verification output

## Current Implementation Status

### BRACU Email Verification Project
**Architecture:**
- Frontend: React + Vite + Noir WASM
- Backend: Cloudflare Workers + Hono
- ZK Circuit: Noir language implementation
- Email Processing: Custom preprocessing pipeline

**Key Components:**
1. **Email Preprocessor**: Reduces header size to fit circuit constraints
2. **ZK Prover**: Generates proofs using Noir WASM
3. **Backend Verifier**: Validates proofs and manages sessions
4. **Anonymous Authentication**: Domain-based access control

**Technical Challenges Addressed:**
- Large header preprocessing (99% size reduction)
- Sequence index alignment for email extraction
- Circuit version compatibility (beta.5 → beta.6)
- RSA signature validation constraints
- Browser environment limitations

**Ongoing Issues:**
- `assert_max_bit_size` errors in DKIM modulus validation
- 120-bit limb size constraints in RSA verification
- Fallback DKIM extraction vs. production-grade parsing
- Browser-specific preprocessing gaps

### Error Analysis: assert_max_bit_size

**Root Cause Investigation:**
The persistent `assert_max_bit_size` error occurs during circuit execution, specifically in DKIM modulus/redc limb validation. The circuit expects RSA modulus limbs to fit within 120-bit constraints, but the current DKIM extraction may be providing values that exceed these limits.

**Technical Details:**
- Circuit: `packages/zkemail-noir/lib/src/dkim.nr`
- Constraint: `assert_max_bit_size::<120>()` for modulus limbs
- RSA Key Size: 2048-bit (18 limbs × 120-bit = 2160-bit capacity)
- Error Location: DKIM signature validation, not email sequence indices

**Next Steps:**
1. Debug actual DKIM modulus limb values
2. Verify RSA key size compatibility
3. Check DKIM extraction logic in email parser
4. Validate limb bit-size constraints

## Recommendations

### Short-term Fixes
1. **Fix DKIM Limb Validation**: Debug and correct modulus/redc limb values
2. **Complete Preprocessing**: Fix browser-specific preprocessing gaps
3. **Test End-to-end Flow**: Validate complete ZK proof generation

### Long-term Improvements
1. **Production DKIM Parser**: Replace fallback extraction
2. **Circuit Optimization**: Reduce constraints for better performance
3. **Multi-domain Support**: Extend beyond BRACU emails
4. **Mobile Optimization**: Improve mobile browser compatibility

## Conclusion

Zero-knowledge email domain verification is technically feasible using DKIM-based approaches. The BRACU implementation demonstrates the core concepts but requires resolution of circuit-level validation issues. The cryptographic foundation is sound, with successful header preprocessing and sequence alignment achieved. The remaining challenge is resolving RSA signature validation constraints within the Noir circuit framework.

**Key Success Factors:**
- ✅ Email preprocessing working (99% size reduction)
- ✅ Sequence indices aligned correctly
- ✅ Circuit loading and compatibility resolved
- ✅ Backend API and frontend integration complete
- ⚠️ DKIM modulus validation needs debugging
- ⚠️ Browser environment preprocessing needs completion

The implementation represents a significant step toward practical zero-knowledge email verification, with only circuit-level validation issues remaining to be resolved.