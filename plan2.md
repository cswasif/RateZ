ZK Proof System Integration: Noir/Barretenberg Migration
Migrate the ZK verification system from Groth16/snarkjs to UltraPlonk/Barretenberg to work with the existing zkemail.nr Noir circuits.

User Review Required
IMPORTANT

The current backend uses snarkjs/Groth16 which is incompatible with Noir circuits. The existing verification key and proof format will need complete replacement.

WARNING

The packages/circuits directory appears to have old Circom circuits. These will be deprecated in favor of the Noir-based approach.

Proposed Changes
Backend - API Verifier
[MODIFY] 
zk-verifier.ts
Replace snarkjs Groth16 verification with Barretenberg UltraPlonk verification:

- import snarkjs from 'snarkjs'
+ import { UltraPlonkBackend } from '@aztec/bb.js'
- const isValid = await snarkjs.groth16.verify(...)
+ const backend = new UltraPlonkBackend(circuitBytecode)
+ const isValid = await backend.verifyProof(proof)
Key changes:

Remove snarkjs dependency
Add @aztec/bb.js dependency
Update ZKProof interface for Noir proof format (ProofData with proof: Uint8Array, publicInputs: string[])
Replace verification-key.ts with compiled circuit JSON
[DELETE] 
verification-key.ts
The Groth16 verification key is incompatible. Will be replaced by embedded circuit bytecode.

[NEW] circuit.json
Compiled Noir circuit (bracu_verifier.json) to embed in the API for verification.

Frontend - Email Parser & Prover
[MODIFY] 
email-parser.ts
Replace mock implementation with real @zk-email/zkemail-nr integration:

+ import { generateEmailVerifierInputs } from '@zk-email/zkemail-nr'
- // Mock RSA components
- const mockPubkey = [BigInt('0x' + 'ff'.repeat(32))]
+ const zkEmailInputs = await generateEmailVerifierInputs(rawEmail, {
+   maxHeaderLength: 512,
+   maxBodyLength: 0  // header-only for bracu_verifier
+ })
[NEW] zk-prover.ts
New service for client-side proof generation using Barretenberg WASM:

import { UltraPlonkBackend } from '@aztec/bb.js'
import { Noir } from '@noir-lang/noir_js'
import circuit from '../circuits/bracu_verifier.json'
export async function generateProof(emailContent: string) {
  const inputs = await generateEmailVerifierInputs(emailContent)
  const noir = new Noir(circuit)
  const backend = new UltraPlonkBackend(circuit.bytecode)
  
  const { witness } = await noir.execute(inputs)
  const proof = await backend.generateProof(witness)
  
  return {
    proof: Array.from(proof.proof),
    publicInputs: proof.publicInputs,
    nullifier: proof.publicInputs[1]  // email_nullifier
  }
}
Circuit Compilation
[MODIFY] 
bracu_verifier/Nargo.toml
Verify compiler version and compile the circuit:

cd packages/zkemail-noir/examples/bracu_verifier
nargo compile
Output: target/bracu_verifier.json - copy to frontend and API.

Package Dependencies
API (packages/api/package.json)
- "snarkjs": "^0.7.x"
+ "@aztec/bb.js": "0.84.0"
+ "@noir-lang/noir_js": "1.0.0-beta.5"
Frontend (packages/frontend/package.json)
+ "@aztec/bb.js": "0.84.0"
+ "@noir-lang/noir_js": "1.0.0-beta.5"
+ "@zk-email/zkemail-nr": "^1.3.2"
+ "@zk-email/helpers": "^6.3.2"
Architecture Summary
Backend
Frontend
Yes
No
Raw Email
generateEmailVerifierInputs
Noir Circuit Execution
UltraPlonk Proof Generation
API /verify-proof
UltraPlonk Verification
Valid?
Store Nullifier
Reject
Verification Plan
Automated Tests
Circuit compilation: nargo compile in bracu_verifier/
Unit test: Run existing zkemail-noir/js tests with yarn test
Integration test: Generate proof from test email, verify via API
Manual Verification
Upload a real BRACU email in frontend
Verify proof generation completes
Confirm nullifier is stored and prevents duplicate submissions
