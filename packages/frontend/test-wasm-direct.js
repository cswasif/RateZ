// Direct WASM module test
async function testWASMModule() {
    console.log('🧪 Testing WASM Module...');
    console.log('=====================================');
    
    try {
        console.log('📦 Loading WASM module...');
        const module = await import('./src/lib/zk-wasm-pkg/zk_wasm.js');
        console.log('✅ WASM module loaded');
        
        console.log('🔄 Initializing WASM...');
        await module.default();
        console.log('✅ WASM initialized');
        
        // Test compute_partial_hash_for_email function
        const testHeader = "From: test@bracu.ac.bd\r\nTo: recipient@example.com\r\nSubject: Test Email";
        const headerBytes = new TextEncoder().encode(testHeader);
        
        console.log('📧 Testing partial hash computation...');
        const result = module.compute_partial_hash_for_email(headerBytes, 2560);
        
        console.log('✅ Partial hash computation successful!');
        console.log('📊 Results:');
        console.log(`   - State: [${result.state.join(', ')}]`);
        console.log(`   - Remaining bytes: ${result.remaining.length}`);
        console.log(`   - Total length: ${result.total_length}`);
        console.log(`   - Prehashed length: ${result.prehashed_length}`);
        
        console.log('=====================================');
        console.log('✅ WASM Test PASSED!');
        return true;
        
    } catch (error) {
        console.error('❌ WASM Test FAILED!');
        console.error('Error:', error instanceof Error ? error.message : String(error));
        console.log('=====================================');
        return false;
    }
}

// Run the test
testWASMModule().then(success => {
    process.exit(success ? 0 : 1);
}).catch(err => {
    console.error('💥 Unexpected error:', err);
    process.exit(1);
});