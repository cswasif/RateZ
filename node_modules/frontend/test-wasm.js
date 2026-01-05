// Simple WASM test script
import { testWASMModule } from '../src/lib/test-wasm.js';

async function runTest() {
    console.log('🧪 Testing WASM Module...');
    console.log('=====================================');
    
    try {
        const result = await testWASMModule();
        
        if (result.success) {
            console.log('✅ WASM Test PASSED!');
            console.log('📊 Results:');
            console.log(`   - Module Loaded: ${result.moduleLoaded}`);
            console.log(`   - Function Available: ${result.functionAvailable}`);
            console.log(`   - Partial Hash State: [${result.result.state.join(', ')}]`);
            console.log(`   - Remaining Bytes: ${result.result.remaining.length}`);
            console.log(`   - Total Length: ${result.result.total_length}`);
            console.log(`   - Prehashed Length: ${result.result.prehashed_length}`);
        } else {
            console.log('❌ WASM Test FAILED!');
            console.log(`   Error: ${result.error}`);
        }
    } catch (error) {
        console.error('💥 Unexpected error:', error);
    }
    
    console.log('=====================================');
}

runTest();