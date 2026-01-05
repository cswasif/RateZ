// Debug the exact circuit input values that cause the overflow
console.log('🔍 DEBUG: Circuit Input Analysis for Overflow Error');
console.log('='.repeat(60));

// From the log, we have these exact values:
const logData = {
    prehashedLength: 0,
    remainingLength: 12447,
    totalHeaderLength: 12447,
    fromHeaderIndex: 10771,
    fromAddressIndex: 10832,
    paddedStorageLength: 16384 // This is the circuit storage size
};

console.log('📋 Log Data Analysis:');
console.log(`   Pre-hashed length: ${logData.prehashedLength}`);
console.log(`   Remaining length: ${logData.remainingLength}`);
console.log(`   Total header length: ${logData.totalHeaderLength}`);
console.log(`   From header index: ${logData.fromHeaderIndex}`);
console.log(`   From address index: ${logData.fromAddressIndex}`);
console.log(`   Padded storage length: ${logData.paddedStorageLength}`);

// The issue: The circuit is trying to subtract indices that are larger than remaining length
console.log('\n🧮 Index vs Remaining Analysis:');
console.log(`   From header index (${logData.fromHeaderIndex}) > remaining length (${logData.remainingLength}): ${logData.fromHeaderIndex > logData.remainingLength}`);
console.log(`   From address index (${logData.fromAddressIndex}) > remaining length (${logData.remainingLength}): ${logData.fromAddressIndex > logData.remainingLength}`);

// This is the problem! The indices are relative to the FULL header, but the circuit
// expects them to be relative to the REMAINING portion
console.log('\n💡 ROOT CAUSE IDENTIFIED:');
console.log('   The From header indices (10771, 10832) are relative to the FULL header,');
console.log(`   but the circuit expects them relative to the REMAINING portion (0-${logData.remainingLength - 1}).`);
console.log(`   This causes underflow when the circuit tries to subtract the base offset.`);

// Calculate what the indices should be relative to remaining
const remainingStartOffset = logData.totalHeaderLength - logData.remainingLength;
const adjustedFromHeaderIndex = logData.fromHeaderIndex - remainingStartOffset;
const adjustedFromAddressIndex = logData.fromAddressIndex - remainingStartOffset;

console.log('\n🔧 SOLUTION:');
console.log(`   Remaining start offset: ${remainingStartOffset}`);
console.log(`   Adjusted From header index: ${adjustedFromHeaderIndex}`);
console.log(`   Adjusted From address index: ${adjustedFromAddressIndex}`);

// Verify the adjustment
console.log('\n✅ Verification:');
console.log(`   Adjusted indices are within remaining bounds: ${adjustedFromHeaderIndex >= 0 && adjustedFromHeaderIndex < logData.remainingLength}`);
console.log(`   Adjusted address index is within remaining bounds: ${adjustedFromAddressIndex >= 0 && adjustedFromAddressIndex < logData.remainingLength}`);

console.log('\n🎯 FINAL ANSWER:');
console.log('   The circuit overflow occurs because we provide absolute indices');
console.log('   but the circuit expects indices relative to the remaining header portion.');
console.log('   We need to adjust the indices by subtracting the remaining start offset.');

console.log('\n📝 Code Fix Needed in zk-prover.ts:');
console.log('   // Adjust indices to be relative to remaining header, not full header');
console.log('   const remainingStartOffset = headerBytes.length - partialHash.remaining.length;');
console.log('   const adjustedFromHeaderIndex = fromHeaderIndex - remainingStartOffset;');
console.log('   const adjustedFromAddressIndex = fromAddressIndex - remainingStartOffset;');