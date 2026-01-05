/**
 * Test the updated email preprocessor with smart email preservation
 */

const fs = require('fs');

// Read the real BRACU email
const emailContent = fs.readFileSync('Final Exam Schedule, Fall 2025.eml', 'utf8');

console.log('🧪 Testing updated email preprocessor with smart email preservation...\n');

// Split headers and body
const headerEndIndex = emailContent.indexOf('\r\n\r\n');
const headerPart = headerEndIndex !== -1 ? emailContent.substring(0, headerEndIndex) : emailContent.substring(0, emailContent.indexOf('\n\n'));

console.log('📧 Original From header:');
const originalFromLine = headerPart.split('\n').find(line => line.toLowerCase().startsWith('from:'));
console.log('- Length:', originalFromLine.length);
console.log('- Content:', originalFromLine);

// Test the updated preprocessing
function preprocessEmailHeaders(headerBytes) {
  const headerStr = new TextDecoder().decode(headerBytes);
  const lines = headerStr.split(/\r?\n/);
  
  // Headers to keep (essential for verification)
  const essentialHeaders = [
    'from:', 'to:', 'subject:', 'date:', 'message-id:'
  ];
  
  // Filter essential headers and remove others
  const processedLines = lines.filter(line => {
    const headerName = line.split(':')[0].toLowerCase() + ':';
    return essentialHeaders.some(h => headerName.startsWith(h));
  });
  
  // Smart truncation that preserves email addresses
  const truncatedLines = processedLines.map(line => {
    const maxLength = 50; // Increased to 50 chars for better email preservation
    if (line.length > maxLength) {
      const colonIndex = line.indexOf(':');
      const headerName = line.substring(0, colonIndex + 1);
      let headerValue = line.substring(colonIndex + 1);
      
      // Special handling for From header to preserve email address
      if (headerName.toLowerCase() === 'from:') {
        // Extract email address using regex
        const emailMatch = headerValue.match(/<([^>]+)>/);
        if (emailMatch) {
          const emailAddress = emailMatch[1];
          // Keep the email address and minimal context
          const namePart = headerValue.substring(0, headerValue.indexOf('<')).trim();
          const maxNameLength = maxLength - headerName.length - emailAddress.length - 3; // 3 for <>
          const truncatedName = namePart.length > maxNameLength 
              ? namePart.substring(0, Math.max(0, maxNameLength - 3)) + '...'
              : namePart;
          return headerName + truncatedName + ' <' + emailAddress + '>';
        }
      }
      
      // For other headers, use smart truncation
      const availableSpace = maxLength - headerName.length - 3;
      const truncatedValue = headerValue.substring(0, Math.max(1, availableSpace)) + '...';
      return headerName + truncatedValue;
    }
    return line;
  });
  
  const processedHeader = truncatedLines.join('\n');
  return new TextEncoder().encode(processedHeader);
}

const headerBytes = new TextEncoder().encode(headerPart);
const processedHeaderBytes = preprocessEmailHeaders(headerBytes);
const processedHeaderStr = new TextDecoder().decode(processedHeaderBytes);

console.log('\n📋 Processed From header:');
const processedFromLine = processedHeaderStr.split('\n').find(line => line.toLowerCase().startsWith('from:'));
console.log('- Length:', processedFromLine.length);
console.log('- Content:', processedFromLine);

// Check if email address is preserved
const emailMatch = processedFromLine.match(/<([^>]+)>/);
if (emailMatch) {
  console.log('\n✅ Email address preserved:', emailMatch[1]);
  console.log('✅ Can be found by parser:', emailMatch[1].toLowerCase());
} else {
  console.log('\n❌ Email address not found in processed header!');
}

console.log('\n📊 Full preprocessing results:');
console.log('- Original size:', headerBytes.length, 'bytes');
console.log('- Processed size:', processedHeaderBytes.length, 'bytes');
console.log('- Savings:', headerBytes.length - processedHeaderBytes.length, 'bytes');

if (processedHeaderBytes.length <= 159) {
  console.log('✅ Fits circuit constraints (≤159 bytes)');
} else {
  console.log('❌ Exceeds circuit limit');
}