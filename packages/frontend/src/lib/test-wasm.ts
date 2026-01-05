// Test WASM module functionality
export async function testWASMModule(): Promise<{ success: boolean; moduleLoaded?: boolean; functionAvailable?: boolean; result?: any; error?: string }> {
    console.log('🧪 Testing WASM module...');
    
    try {
        // Test loading the WASM module
        const module = await import('./zk-wasm-pkg/zk_wasm.js');
        console.log('✅ WASM module loaded:', module);
        
        // Initialize WASM
        await module.default();
        console.log('✅ WASM initialized');
        
        // Test compute_partial_hash_for_email function
        const testHeader = "From: test@bracu.ac.bd\r\nTo: recipient@example.com\r\nSubject: Test Email";
        const headerBytes = new TextEncoder().encode(testHeader);
        
        console.log('📧 Testing partial hash computation...');
        const result = module.compute_partial_hash_for_email(headerBytes, 2560);
        
        console.log('✅ Partial hash result:', {
            state: result.state,
            remainingLength: result.remaining.length,
            totalLength: result.total_length,
            prehashedLength: result.prehashed_length
        });
        
        return {
            success: true,
            moduleLoaded: true,
            functionAvailable: true,
            result: result
        };
        
    } catch (error) {
        console.error('❌ WASM test failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

// Test function that can be called from the browser
(window as any).testWASM = testWASMModule;