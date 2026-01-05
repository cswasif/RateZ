// Debug script to verify our fixes are applied in browser
console.log('🔍 DEBUG: Checking if circuit fixes are applied...');

// Simulate the exact same logic as zk-prover.ts
function debugCircuitInputs() {
    // Mock data similar to what's in the log
    const partialHash = {
        state: [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225],
        remaining: new Uint8Array(12447), // 12447 bytes remaining (from log)
        totalLength: 12447,
        prehashedLength: 0
    };
    
    console.log('📊 Debug Data from Log:');
    console.log(`   Remaining header length: ${partialHash.remaining.length}`);
    console.log(`   Total header length: ${partialHash.totalLength}`);
    
    // Check what our fixes should produce
    const remainingLength = partialHash.remaining.length;
    const paddedLength = Math.ceil(remainingLength / 64) * 64;
    
    console.log('\n🔧 Our Circuit Fixes:');
    console.log(`   remaining_header.len should be: ${remainingLength} (actual remaining length)`);
    console.log(`   total_header_length should be: ${remainingLength} (actual remaining length)`);
    console.log(`   padded_remaining length should be: ${paddedLength} (64-byte aligned)`);
    
    // Check for underflow
    const maxCircuitSize = 512;
    const underflowRisk = remainingLength > maxCircuitSize;
    
    console.log('\n🛡️  Underflow Analysis:');
    console.log(`   Remaining length: ${remainingLength} bytes`);
    console.log(`   Circuit limit: ${maxCircuitSize} bytes`);
    console.log(`   Underflow risk: ${underflowRisk}`);
    
    if (underflowRisk) {
        console.log('   ❌ ERROR: This would cause underflow with our current fixes!');
        console.log('   🔧 Need: Additional chunking or larger circuit capacity');
    } else {
        console.log('   ✅ Safe: Within circuit limits');
    }
    
    // The real issue: 12447 > 512
    console.log('\n💡 CRITICAL FINDING:');
    console.log(`   The remaining header (${remainingLength} bytes) exceeds circuit capacity!`);
    console.log(`   Our fixes work for ≤512 bytes, but this email has ${remainingLength} bytes remaining.`);
    console.log(`   Need to implement additional chunking in the circuit itself.`);
    
    return {
        remainingLength,
        underflowRisk,
        needsChunking: underflowRisk,
        suggestedFix: "Implement circuit-level chunking for large headers"
    };
}

const result = debugCircuitInputs();

console.log('\n🎯 SOLUTION NEEDED:');
if (result.needsChunking) {
    console.log('   The circuit itself needs to handle large headers differently.');
    console.log('   Our TypeScript fixes are correct, but the Noir circuit needs modification.');
    console.log('   Options:');
    console.log('   1. Increase circuit capacity for remaining_header');
    console.log('   2. Implement circuit-level header chunking');
    console.log('   3. Process more header bytes in pre-hash phase');
}

console.log('\n🔍 Next Steps:');
console.log('   1. Check the Noir circuit definition for remaining_header capacity');
console.log('   2. Modify circuit to handle larger remaining headers');
console.log('   3. Or increase pre-hashing to reduce remaining bytes');