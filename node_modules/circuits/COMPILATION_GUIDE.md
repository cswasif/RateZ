# ZK Circuits Compilation Guide

## Prerequisites

### 1. Install Rust
```bash
# Windows (using rustup)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Or download from https://rustup.rs/
```

### 2. Install Circom
```bash
# Clone circom repository
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom

# Verify installation
circom --version
```

## Compilation Steps

### Step 1: Generate Regex Circuit
```bash
cd packages/circuits
npm run gen-regex
```

### Step 2: Compile Main Circuit
```bash
npm run compile
```

### Step 3: Generate Trusted Setup (for development)
```bash
# Generate powers of tau (this is a large file, ~1.4GB)
snarkjs powersoftau new bn128 14 pot14_0000.ptau -v

# Contribute to ceremony (can be done multiple times)
snarkjs powersoftau contribute pot14_0000.ptau pot14_0001.ptau --name="First contribution" -v

# Generate final pot file
snarkjs powersoftau prepare phase2 pot14_0001.ptau pot14_final.ptau -v

# Generate zkey for your circuit
snarkjs groth16 setup build/bracu_verifier.r1cs pot14_final.ptau build/bracu_verifier_0000.zkey

# Contribute to phase 2 ceremony
snarkjs zkey contribute build/bracu_verifier_0000.zkey build/bracu_verifier_0001.zkey --name="Second contribution" -v

# Export final zkey
snarkjs zkey export verificationkey build/bracu_verifier_0001.zkey build/verification_key.json
```

### Step 4: Copy Files to Frontend
```bash
# Create build directory if not exists
mkdir -p build

# Copy WASM prover
cp build/bracu_verifier_js/bracu_verifier.wasm ../frontend/public/

# Copy final zkey
cp build/bracu_verifier_0001.zkey ../frontend/public/bracu_verifier_final.zkey

# Copy verification key for API
cp build/verification_key.json ../frontend/public/
```

## Alternative: Use Pre-compiled Files

If you can't install circom, you can use pre-compiled files:

1. **Download from GitHub Releases** (when available)
2. **Use development keys** (for testing only)
3. **Request compiled files** from the development team

## Verification

After compilation, verify the files:

```bash
# Check WASM file
ls -la ../frontend/public/bracu_verifier.wasm

# Check zkey file
ls -la ../frontend/public/bracu_verifier_final.zkey

# Check verification key
ls -la ../frontend/public/verification_key.json
```

## Security Notes

⚠️ **IMPORTANT**: The trusted setup ceremony should be performed by multiple parties for production use. For development, you can use the steps above, but for production deployment:

1. **Use a multi-party ceremony** with trusted participants
2. **Never reuse ceremony files** across different applications
3. **Verify the ceremony** using snarkjs verification tools
4. **Keep ceremony artifacts secure** and auditable

## Troubleshooting

### Common Issues:

1. **Rust not found**: Install Rust from https://rustup.rs/
2. **Circom compilation fails**: Ensure you have the latest Rust version
3. **Out of memory**: The powers of tau generation requires ~8GB RAM
4. **Permission errors**: Run as administrator on Windows

### Getting Help:
- Circom documentation: https://docs.circom.io/
- ZK Email circuits: https://github.com/zkemail/zk-email-verify
- Snarkjs documentation: https://github.com/iden3/snarkjs