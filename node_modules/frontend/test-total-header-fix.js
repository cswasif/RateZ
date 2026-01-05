// Test the total_header_length fix
import { readFileSync } from 'fs';

console.log('🧪 Testing total_header_length fix...');

// Simulate the data from the log
const partialHash = {
    state: [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225],
    remaining: new Uint8Array(12447), // 12447 bytes remaining
    prehashedLength: 0,
    totalLength: 12447
};

const headerBytes = new Uint8Array(12447); // Original header length
const fromHeaderIndex = 10771;
const fromAddressIndex = 10832;

console.log('📊 Test Data:');
console.log('  - Original header length:', headerBytes.length);
console.log('  - Remaining length:', partialHash.remaining.length);
console.log('  - From header index:', fromHeaderIndex);
console.log('  - From address index:', fromAddressIndex);

console.log('🔧 Fixed total_header_length:', headerBytes.length.toString());
console.log('🔧 Previous total_header_length:', partialHash.remaining.length.toString());

// Check if indices are valid
const effectiveRemainingLength = Math.min(partialHash.remaining.length, 16384);
console.log('📏 Effective remaining length:', effectiveRemainingLength);

if (fromHeaderIndex >= effectiveRemainingLength) {
    console.log('❌ ERROR: From header index is out of bounds!');
    console.log('   Index:', fromHeaderIndex, '>= Remaining:', effectiveRemainingLength);
} else {
    console.log('✅ From header index is within bounds');
}

if (fromAddressIndex >= effectiveRemainingLength) {
    console.log('❌ ERROR: From address index is out of bounds!');
    console.log('   Index:', fromAddressIndex, '>= Remaining:', effectiveRemainingLength);
} else {
    console.log('✅ From address index is within bounds');
}

console.log('🎯 Fix Summary:');
console.log('   - Changed total_header_length from remaining length to original header length');
console.log('   - This should resolve the subtraction underflow in the circuit');