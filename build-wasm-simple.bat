@echo off
echo Building WASM module...

cd packages\zk-wasm

REM Build with cargo directly for wasm32 target
cargo build --target wasm32-unknown-unknown --release

REM Create output directory
if not exist ..\frontend\src\lib\zk-wasm-pkg mkdir ..\frontend\src\lib\zk-wasm-pkg

REM Copy the built WASM file
copy target\wasm32-unknown-unknown\release\zk_wasm.wasm ..\frontend\src\lib\zk-wasm-pkg\

REM Generate a simple JS wrapper
echo // Auto-generated WASM wrapper > ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo let wasm; >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo. >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo export async function initWasm() { >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo     if (wasm) return wasm; >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo. >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo     const wasmModule = await WebAssembly.instantiateStreaming(fetch('./zk_wasm.wasm')); >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo     wasm = wasmModule.instance.exports; >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo. >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo     return wasm; >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo } >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo. >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo export function compute_partial_hash_for_email(header_bytes, max_remaining_len) { >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo     if (!wasm) throw new Error('WASM not initialized'); >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo     // Implementation would go here - this is a placeholder >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo     return { >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo         state: new Array(8).fill(0), >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo         remaining: header_bytes, >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo         total_length: header_bytes.length, >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo         prehashed_length: 0 >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo     }; >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo } >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo. >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo export function compute_sha256(data) { >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo     if (!wasm) throw new Error('WASM not initialized'); >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo     // Implementation would go here - this is a placeholder >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo     return new Uint8Array(32); >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js
echo } >> ..\frontend\src\lib\zk-wasm-pkg\zk_wasm.js

echo WASM build complete!
echo Files created:
echo   - packages/frontend/src/lib/zk-wasm-pkg/zk_wasm.wasm
echo   - packages/frontend/src/lib/zk-wasm-pkg/zk_wasm.js