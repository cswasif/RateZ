#!/bin/bash

# Simple build script for WASM module using cargo directly
# This avoids wasm-pack dependency issues

echo "Building WASM module..."

cd packages/zk-wasm

# Build with cargo directly for wasm32 target
cargo build --target wasm32-unknown-unknown --release

# Create output directory
mkdir -p ../frontend/src/lib/zk-wasm-pkg

# Copy the built WASM file
cp target/wasm32-unknown-unknown/release/zk_wasm.wasm ../frontend/src/lib/zk-wasm-pkg/

# Generate a simple JS wrapper
cat > ../frontend/src/lib/zk-wasm-pkg/zk_wasm.js << 'EOF'
// Auto-generated WASM wrapper
let wasm;

export async function initWasm() {
    if (wasm) return wasm;
    
    const wasmModule = await WebAssembly.instantiateStreaming(fetch('./zk_wasm.wasm'));
    wasm = wasmModule.instance.exports;
    
    return wasm;
}

export function compute_partial_hash_for_email(header_bytes, max_remaining_len) {
    if (!wasm) throw new Error('WASM not initialized');
    // Implementation would go here - this is a placeholder
    return {
        state: new Array(8).fill(0),
        remaining: header_bytes,
        total_length: header_bytes.length,
        prehashed_length: 0
    };
}

export function compute_sha256(data) {
    if (!wasm) throw new Error('WASM not initialized');
    // Implementation would go here - this is a placeholder
    return new Uint8Array(32);
}
EOF

echo "WASM build complete!"
echo "Files created:"
echo "  - packages/frontend/src/lib/zk-wasm-pkg/zk_wasm.wasm"
echo "  - packages/frontend/src/lib/zk-wasm-pkg/zk_wasm.js"