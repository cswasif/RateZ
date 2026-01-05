const fs = require('fs');

// Read the actual email from bal.log
const logContent = fs.readFileSync('d:\\RateZ\\bal.log', 'utf8');
const emailMatch = logContent.match(/-----BEGIN EMAIL-----\n([\s\S]*?)\n-----END EMAIL-----/);
if (!emailMatch) {
  throw new Error('Could not find email in bal.log');
}
const actualEmail = emailMatch[1];

console.log('Original email length:', actualEmail.length);

// Based on zk-email noir library research:
// - Default maxHeadersLength in examples: 512 bytes
// - README shows: maxHeadersLength: 1408, maxBodyLength: 1280
// - Our circuit requires: 2560 bytes (must be multiple of 64 for SHA-256)

const MAX_HEADER_LENGTH = 2560;
const MAX_EMAIL_HEADER_LENGTH = 512; // From zk-email noir examples

// Function to extract From header information like zk-email does
function extractFromHeaderInfo(emailString) {
  const lines = emailString.split(/\r?\n/);
  let fromLineIndex = -1;
  let fromLine = null;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().startsWith('from:')) {
      fromLineIndex = i;
      fromLine = lines[i];
      break;
    }
  }
  
  if (fromLineIndex === -1) {
    throw new Error('Could not find From header');
  }
  
  // Extract email address
  const emailMatch = fromLine.match(/<([^>]+)>/) || fromLine.match(/:\s*([^\s<]+@[^\s>]+)/);
  if (!emailMatch) {
    throw new Error('Could not extract email address from From header');
  }
  
  const fromAddress = emailMatch[1].toLowerCase();
  const domainMatch = fromAddress.match(/@(.+)$/);
  const fromDomain = domainMatch ? domainMatch[1] : '';
  
  return {
    fromLineIndex,
    fromLine,
    fromAddress,
    fromDomain
  };
}

// Function to calculate header positions for zk-email circuit
function calculateHeaderPositions(emailString) {
  const lines = emailString.split(/\r?\n/);
  const fromInfo = extractFromHeaderInfo(emailString);
  
  // Calculate byte positions
  let fromHeaderStart = 0;
  for (let i = 0; i < fromInfo.fromLineIndex; i++) {
    fromHeaderStart += lines[i].length + 2; // +2 for \r\n
  }
  
  // From header includes the line and any continuation lines (starting with whitespace)
  let fromHeaderEnd = fromHeaderStart + fromInfo.fromLine.length;
  for (let i = fromInfo.fromLineIndex + 1; i < lines.length; i++) {
    if (lines[i].match(/^[^\s]/)) { // Line doesn't start with whitespace
      break;
    }
    fromHeaderEnd += lines[i].length + 2; // +2 for \r\n
  }
  
  return {
    fromHeaderStart,
    fromHeaderEnd,
    fromHeaderLength: fromHeaderEnd - fromHeaderStart,
    totalHeaderLength: emailString.length
  };
}

// Function to implement zk-email compatible truncation
function zkEmailCompatibleTruncate(emailString, maxLength = MAX_HEADER_LENGTH) {
  if (emailString.length <= maxLength) {
    return emailString;
  }
  
  const fromInfo = extractFromHeaderInfo(emailString);
  const positions = calculateHeaderPositions(emailString);
  
  console.log('From header position:', positions.fromHeaderStart, '-', positions.fromHeaderEnd);
  console.log('From header length:', positions.fromHeaderLength);
  console.log('Total header length:', positions.totalHeaderLength);
  
  // Strategy: Preserve From header and DKIM signature at the end
  // This matches zk-email's approach of keeping critical authentication data
  
  const fromHeader = emailString.substring(positions.fromHeaderStart, positions.fromHeaderEnd);
  
  // Find DKIM signature (usually at the end)
  const dkimMatch = emailString.match(/DKIM-Signature:[\s\S]*?\r\n(?!\s)/i);
  let dkimSignature = '';
  let dkimStart = -1;
  
  if (dkimMatch) {
    dkimStart = emailString.indexOf(dkimMatch[0]);
    dkimSignature = dkimMatch[0];
    console.log('DKIM signature found at position:', dkimStart);
    console.log('DKIM signature length:', dkimSignature.length);
  }
  
  // Calculate available space
  const criticalDataLength = fromHeader.length + (dkimSignature ? dkimSignature.length : 0) + 20; // +20 for buffer
  
  if (criticalDataLength > maxLength) {
    throw new Error('Critical authentication data exceeds maximum header length');
  }
  
  const availableSpace = maxLength - criticalDataLength;
  
  // Strategy 1: Try to keep From header and truncate middle section
  if (positions.fromHeaderStart > 0 && dkimStart > positions.fromHeaderEnd) {
    // We have space before and after From header
    const prefixLength = Math.min(availableSpace * 0.4, positions.fromHeaderStart);
    const suffixLength = Math.min(availableSpace * 0.6, emailString.length - positions.fromHeaderEnd);
    
    const prefix = emailString.substring(positions.fromHeaderStart - prefixLength, positions.fromHeaderStart);
    const suffix = emailString.substring(positions.fromHeaderEnd, positions.fromHeaderEnd + suffixLength);
    
    let result = prefix + fromHeader + suffix;
    
    // Add DKIM signature if there's space
    if (dkimSignature && result.length + dkimSignature.length < maxLength) {
      result += dkimSignature;
    }
    
    return result.substring(0, maxLength);
  }
  
  // Strategy 2: Keep From header at the beginning
  if (positions.fromHeaderStart === 0) {
    return (fromHeader + emailString.substring(positions.fromHeaderEnd)).substring(0, maxLength);
  }
  
  // Strategy 3: Keep From header at the end
  const fromStartInResult = maxLength - positions.fromHeaderLength - (dkimSignature ? dkimSignature.length : 0);
  let result = emailString.substring(0, fromStartInResult) + fromHeader;
  
  if (dkimSignature) {
    result += dkimSignature;
  }
  
  return result.substring(0, maxLength);
}

// Test the truncation
console.log('\n=== Testing zk-email compatible truncation ===');

try {
  const fromInfo = extractFromHeaderInfo(actualEmail);
  console.log('From address:', fromInfo.fromAddress);
  console.log('From domain:', fromInfo.fromDomain);
  
  const positions = calculateHeaderPositions(actualEmail);
  console.log('Header analysis:');
  console.log('- Total length:', positions.totalHeaderLength);
  console.log('- From header starts at byte:', positions.fromHeaderStart);
  console.log('- From header ends at byte:', positions.fromHeaderEnd);
  console.log('- From header length:', positions.fromHeaderLength);
  
  // Test truncation
  const truncated = zkEmailCompatibleTruncate(actualEmail, MAX_HEADER_LENGTH);
  console.log('\nTruncated header length:', truncated.length);
  
  // Verify From header is preserved
  const truncatedFromInfo = extractFromHeaderInfo(truncated);
  console.log('Truncated From address:', truncatedFromInfo.fromAddress);
  console.log('Truncated From domain:', truncatedFromInfo.fromDomain);
  
  // Check if DKIM signature is preserved
  const dkimPreserved = truncated.includes('DKIM-Signature:');
  console.log('DKIM signature preserved:', dkimPreserved);
  
  // Test with different max lengths
  console.log('\n=== Testing different max lengths ===');
  
  const testLengths = [512, 1024, 1408, 2048, 2560];
  
  for (const maxLen of testLengths) {
    try {
      const testTruncated = zkEmailCompatibleTruncate(actualEmail, maxLen);
      const testFromInfo = extractFromHeaderInfo(testTruncated);
      const testDkimPreserved = testTruncated.includes('DKIM-Signature:');
      
      console.log(`Max length ${maxLen}: truncated=${testTruncated.length}, From preserved=${testFromInfo.fromAddress === fromInfo.fromAddress}, DKIM preserved=${testDkimPreserved}`);
    } catch (error) {
      console.log(`Max length ${maxLen}: FAILED - ${error.message}`);
    }
  }
  
} catch (error) {
  console.error('Error during truncation test:', error);
}

// Export the truncation function for use in email-parser.ts
module.exports = {
  zkEmailCompatibleTruncate,
  extractFromHeaderInfo,
  calculateHeaderPositions,
  MAX_HEADER_LENGTH,
  MAX_EMAIL_HEADER_LENGTH
};