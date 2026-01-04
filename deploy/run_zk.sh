#!/bin/bash
set -e
CIRCUIT_DIR="packages/circuits"
BUILD_DIR="$CIRCUIT_DIR/build"

# Ensure environment variables
source "$HOME/.cargo/env"

echo "Starting Production ZK Ceremony..."

# 1. Install Dependencies
echo "Installing project dependencies..."
npm install
cd packages/circuits
npm install
cd ../..

# 2. Compile Circuit (Rust Circom) - Fast
echo "Compiling Circuit..."
mkdir -p $BUILD_DIR
# Using -l node_modules relative to execution root
circom $CIRCUIT_DIR/src/bracu_verifier_simple.circom --r1cs --wasm --sym -o $BUILD_DIR -l node_modules

# 3. Trusted Setup (Hybrid: Hermez P1 + Drand P2)
cd $BUILD_DIR

# Download Phase 1 (Hermez 2^20) - ~150MB
if [ ! -f powersOfTau28_hez_final_20.ptau ]; then
    echo "Downloading Hermez Powers of Tau (2^20)..."
    wget -q --show-progress https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_20.ptau
fi

# Phase 2 Initialization (Drand Entropy)
echo "Fetching Drand Randomness..."
DRAND_HEX=$(curl -s https://api.drand.sh/public/latest | jq -r '.randomness')
echo "Randomness: $DRAND_HEX"

echo "Phase 2: Initialization (Groth16 Setup)..."
# bracu_verifier_simple.r1cs + Ptau -> Zkey
snarkjs groth16 setup bracu_verifier_simple.r1cs powersOfTau28_hez_final_20.ptau bracu_0000.zkey

echo "Phase 2: Contribution (with Drand)..."
snarkjs zkey contribute bracu_0000.zkey bracu_final.zkey --name="ZKRateMyProf" -v -e="$DRAND_HEX"

echo "Exporting Verification Key..."
snarkjs zkey export verificationkey bracu_final.zkey verification_key.json

# Cleanup intermediate zkey
rm bracu_0000.zkey

echo "Deploying Artifacts..."
# Copy to API (Verification Key)
cp verification_key.json ../../../packages/api/src/lib/

# Copy to Frontend (Proving Key + WASM)
mkdir -p ../../../packages/frontend/public/circuits
cp bracu_verifier_simple_js/bracu_verifier_simple.wasm ../../../packages/frontend/public/circuits/bracu_verifier.wasm
cp bracu_final.zkey ../../../packages/frontend/public/circuits/bracu_verifier_final.zkey

echo "ZK Ceremony Complete!"
