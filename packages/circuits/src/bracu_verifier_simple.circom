pragma circom 2.1.6;

include "@zk-email/circuits/email-verifier.circom";

// BracU Email Verifier - proves @g.bracu.ac.bd email ownership
// Uses zk-email v6.3.4 EmailVerifier template
template BracuVerifier(maxHeadersLength, maxBodyLength, n, k) {
    // EmailVerifier params: (maxHeadersLength, maxBodyLength, n, k, 
    //   ignoreBodyHashCheck, enableHeaderMasking, enableBodyMasking, removeSoftLineBreaks)
    component emailVerifier = EmailVerifier(maxHeadersLength, maxBodyLength, n, k, 1, 0, 0, 0);
    
    // Inputs from EmailVerifier
    signal input emailHeader[maxHeadersLength];
    signal input emailHeaderLength;
    signal input pubkey[k];
    signal input signature[k];

    // Wire inputs to EmailVerifier
    emailVerifier.emailHeader <== emailHeader;
    emailVerifier.emailHeaderLength <== emailHeaderLength;
    emailVerifier.pubkey <== pubkey;
    emailVerifier.signature <== signature;

    // Outputs
    signal output pubkeyHash;
    signal output nullifier;

    // Get pubkey hash from EmailVerifier
    pubkeyHash <== emailVerifier.pubkeyHash;
    
    // Nullifier is the pubkey hash (unique per email signer)
    nullifier <== emailVerifier.pubkeyHash;
}

// Main component: RSA-2048 (n=121, k=17)
// Using 1024 bytes max header, 0 body (headers only)
component main { public [pubkey] } = BracuVerifier(1024, 64, 121, 17);