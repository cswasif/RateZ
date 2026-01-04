# ZK Circuits for BracU

This package contains the Circom circuits for verifying `@g.bracu.ac.bd` emails.

## Prerequisites

You MUST have **Circom** (Rust version) installed to compile these circuits.

### 1. Install Circom
**Windows (PowerShell):**
```powershell
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
cargo install --git https://github.com/iden3/circom.git
```
*Note: This requires Rust.*

### 2. Install Dependencies
```bash
npm install
```

## Usage

### 1. Generate Regex Circuit
First, generate the regex matcher for `@g.bracu.ac.bd`:
```bash
npm run gen-regex
```
This creates `src/bracu_regex.circom`.

### 2. Compile Circuit
```bash
npm run compile
```
This generates the `.wasm` and `.r1cs` files in `build/`.

### 3. Generate Keys (Trusted Setup)
You need to generate the `.zkey` file for proving.
```bash
# Power of Tau (Phase 1)
snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
snarkjs powersoftau contribute pot12_0000.ptau pot12_final.ptau --name="First contribution" -v -e="random text"

# Phase 2
snarkjs groth16 setup build/bracu_verifier.r1cs pot12_final.ptau bracu_verifier_0000.zkey
snarkjs zkey contribute bracu_verifier_0000.zkey bracu_verifier_final.zkey --name="Second contribution" -v -e="more random text"
snarkjs zkey export verificationkey bracu_verifier_final.zkey verification_key.json
```
