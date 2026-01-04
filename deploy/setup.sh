#!/bin/bash
set -e

echo "Initializing VPS Setup..."

# 1. Install System Dependencies
echo "Installing dependencies..."
sudo apt-get update
sudo apt-get install -y build-essential curl git unzip jq git-lfs

# 2. Install Rust
if ! command -v rustc &> /dev/null; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi

# 3. Install Node.js 20
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# 4. Install wasm-pack (for zk-wasm)
if ! command -v wasm-pack &> /dev/null; then
    echo "Installing wasm-pack..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# 5. Install Circom (Production Grade)
if ! command -v circom &> /dev/null; then
    echo "Installing Circom..."
    # Always clean old dir
    rm -rf circom
    git clone https://github.com/iden3/circom.git
    cd circom
    cargo build --release
    sudo cp target/release/circom /usr/local/bin/circom
    cd ..
    rm -rf circom
fi

# 6. Global NPM tools
sudo npm install -g snarkjs http-server pm2

echo "Setup Complete!"
