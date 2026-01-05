const fs = require('fs');

// Based on zk-email noir library research and current error analysis
// The issue is not header truncation but circuit execution: "attempt to subtract with overflow"

// From the log analysis:
// - Header is already truncated to 2560 bytes correctly
// - From header is preserved at position 1278
// - The error occurs during circuit execution, not input generation

console.log('=== zk-email Circuit Analysis ===');
console.log('Based on MCP research of zk-email noir library:');
console.log('- Default maxHeadersLength in examples: 512 bytes');
console.log('- README shows: maxHeadersLength: 1408, maxBodyLength: 1280');
console.log('- Our circuit requires: 2560 bytes (multiple of 64 for SHA-256)');
console.log('');

// The real issue: Circuit execution error "attempt to subtract with overflow"
// This suggests the circuit is trying to access data outside the bounded range

// Solution: Ensure all indices are within valid bounds
function validateCircuitInputs(headerLength, fromHeaderIndex, fromHeaderLength, fromAddressIndex, fromAddressLength) {
  console.log('Validating circuit input bounds:');
  console.log(`- Header length: ${headerLength}`);
  console.log(`- From header index: ${fromHeaderIndex}`);
  console.log(`- From header length: ${fromHeaderLength}`);
  console.log(`- From address index: ${fromAddressIndex}`);
  console.log(`- From address length: ${fromAddressLength}`);
  
  // Check bounds
  const validation = {
    headerIndexValid: fromHeaderIndex < headerLength,
    headerEndValid: fromHeaderIndex + fromHeaderLength <= headerLength,
    addressIndexValid: fromAddressIndex < headerLength,
    addressEndValid: fromAddressIndex + fromAddressLength <= headerLength,
    addressWithinHeader: fromAddressIndex >= fromHeaderIndex && 
                          fromAddressIndex + fromAddressLength <= fromHeaderIndex + fromHeaderLength
  };
  
  console.log('\nValidation results:');
  console.log(`- Header index valid: ${validation.headerIndexValid}`);
  console.log(`- Header end valid: ${validation.headerEndValid}`);
  console.log(`- Address index valid: ${validation.addressIndexValid}`);
  console.log(`- Address end valid: ${validation.addressEndValid}`);
  console.log(`- Address within header: ${validation.addressWithinHeader}`);
  
  return validation;
}

// From the log data
const headerLength = 2560;
const fromHeaderIndex = 1278;
const fromHeaderLength = 88;
const fromAddressIndex = 1338;
const fromAddressLength = 27;

console.log('=== Current Circuit Input Analysis ===');
const validation = validateCircuitInputs(headerLength, fromHeaderIndex, fromHeaderLength, fromAddressIndex, fromAddressLength);

if (!validation.headerIndexValid || !validation.headerEndValid || 
    !validation.addressIndexValid || !validation.addressEndValid) {
  console.error('\n❌ CIRCUIT INPUT VALIDATION FAILED');
  console.error('This explains the "attempt to subtract with overflow" error');
  
  // Calculate the safe bounds
  const maxSafeHeaderIndex = headerLength - fromHeaderLength;
  const maxSafeAddressIndex = headerLength - fromAddressLength;
  
  console.log('\nSuggested fixes:');
  console.log(`- Reduce fromHeaderIndex to <= ${maxSafeHeaderIndex}`);
  console.log(`- Reduce fromAddressIndex to <= ${maxSafeAddressIndex}`);
  console.log(`- Ensure fromAddressIndex is within fromHeader bounds`);
  
} else {
  console.log('\n✅ Circuit inputs are within bounds');
  console.log('The overflow error may be coming from elsewhere in the circuit');
}

console.log('\n=== zk-email Best Practices ===');
console.log('Based on MCP analysis of zk-email noir library:');
console.log('');
console.log('1. Header Length Configuration:');
console.log('   - Use maxHeadersLength: 1408 (from README example)');
console.log('   - Or maxHeadersLength: 512 (from 1024-bit example)');
console.log('   - Must be multiple of 64 for SHA-256 compatibility');
console.log('');
console.log('2. Input Generation Strategy:');
console.log('   - Use generateEmailVerifierInputs() from @zk-email/zkemail-nr');
console.log('   - Let the library handle truncation and padding');
console.log('   - Specify maxHeadersLength and maxBodyLength explicitly');
console.log('');
console.log('3. Circuit Design:');
console.log('   - Use BoundedVec<u8, MAX_LENGTH> for headers');
console.log('   - Ensure all sequence indices are within bounds');
console.log('   - Validate header field sequences before use');
console.log('');
console.log('4. Recommended Solution:');
console.log('   - Switch to using @zk-email/zkemail-nr library');
console.log('   - Use their generateEmailVerifierInputs() function');
console.log('   - Let the library handle the complex truncation logic');
console.log('   - This ensures compatibility with the noir circuit');

// Export the validation function for use in the actual implementation
module.exports = {
  validateCircuitInputs,
  MAX_HEADER_LENGTH: 2560,
  RECOMMENDED_HEADER_LENGTH: 1408
};