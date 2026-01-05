// Manual test script for ZK Prover
// Run this in the browser console to test the ZK proof generation

export async function runManualZKTest() {
    console.log('🧪 Starting manual ZK Prover test...');
    
    try {
        // Test 1: Check if test function is available
        if (typeof (window as any).testZKProver !== 'function') {
            throw new Error('testZKProver function not found on window object');
        }
        console.log('✅ testZKProver function is available');
        
        // Test 2: Run the test
        console.log('🚀 Running ZK Prover test...');
        const result = await (window as any).testZKProver();
        
        console.log('📊 Test Results:', result);
        
        // Test 3: Analyze results
        if (result.success) {
            console.log('🎉 SUCCESS: All tests passed!');
            console.log('   - WASM module working:', result.wasmWorking);
            console.log('   - Circuit loaded:', result.circuitLoaded);
            console.log('   - Proof generated:', result.proofGenerated);
            console.log('   - Details:', result.details);
        } else {
            console.error('❌ FAILURE: Test failed');
            console.error('   - Error:', result.error);
            console.error('   - Details:', result.details);
            
            // Provide specific guidance based on error
            if (result.error.includes('deserialize')) {
                console.error('🔧 SUGGESTION: Circuit deserialization failed. This might be due to version mismatch.');
            } else if (result.error.includes('WASM')) {
                console.error('🔧 SUGGESTION: WASM module failed to load. Check browser console for WASM errors.');
            } else if (result.error.includes('circuit')) {
                console.error('🔧 SUGGESTION: Circuit loading failed. Check network connection and circuit file availability.');
            }
        }
        
        return result;
        
    } catch (error) {
        console.error('💥 Unexpected error during test:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

// Auto-run if in browser environment
if (typeof window !== 'undefined') {
    console.log('📝 Manual ZK Test script loaded. Call runManualZKTest() to run the test.');
    (window as any).runManualZKTest = runManualZKTest;
}