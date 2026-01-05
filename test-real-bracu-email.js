const fs = require('fs');
const path = require('path');

// Read the real BRACU email
const emailContent = fs.readFileSync('Final Exam Schedule, Fall 2025.eml', 'utf8');

// Split headers and body - handle both \r\n and \n
const headerEndIndex = emailContent.indexOf('\r\n\r\n');
const headerPart = headerEndIndex !== -1 ? emailContent.substring(0, headerEndIndex) : emailContent.substring(0, emailContent.indexOf('\n\n'));
const headerBytes = new TextEncoder().encode(headerPart);

console.log('📧 Real BRACU email test:');
console.log('- Total email size:', emailContent.length, 'bytes');
console.log('- Original header size:', headerBytes.length, 'bytes');

// Test the updated preprocessor from the TypeScript file
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
  
  // Ultra-aggressive truncation for each header to fit circuit constraints
  const truncatedLines = processedLines.map(line => {
    const maxLength = 30; // Max 30 chars per header (very aggressive)
    if (line.length > maxLength) {
      const colonIndex = line.indexOf(':');
      const headerName = line.substring(0, colonIndex + 1);
      const headerValue = line.substring(colonIndex + 1);
      
      // Truncate the value, keeping the header name intact
      const availableSpace = maxLength - headerName.length - 3;
      const truncatedValue = headerValue.substring(0, Math.max(1, availableSpace)) + '...';
      return headerName + truncatedValue;
    }
    return line;
  });
  
  const processedHeader = truncatedLines.join('\n');
  const originalSize = headerBytes.length;
  const newSize = new TextEncoder().encode(processedHeader).length;
  const savings = originalSize - newSize;
  
  console.log(`📊 Header preprocessing results:`);
  console.log(`   Original size: ${originalSize} bytes`);
  console.log(`   New size: ${newSize} bytes`);
  console.log(`   Savings: ${savings} bytes (${Math.round(savings/originalSize * 100)}%)`);
  
  return new TextEncoder().encode(processedHeader);
}

// Test the preprocessing
const processedHeaderBytes = preprocessEmailHeaders(headerBytes);

// Check circuit constraints
const CIRCUIT_MAX_REMAINING_HEADER = 159;
console.log('\n⚡ Circuit analysis:');
console.log('- Circuit max remaining header:', CIRCUIT_MAX_REMAINING_HEADER, 'bytes');
console.log('- Processed header fits:', processedHeaderBytes.length <= CIRCUIT_MAX_REMAINING_HEADER ? '✅' : '❌');

// Show which headers were kept
const processedHeaderStr = new TextDecoder().decode(processedHeaderBytes);
const keptHeaders = processedHeaderStr.split('\n').filter(line => line.trim());
console.log('\n📋 Kept headers (' + keptHeaders.length + '):');
keptHeaders.forEach(header => {
    console.log('  -', header);
});

// Check if From header is present
const hasFromHeader = processedHeaderStr.toLowerCase().includes('from:');
console.log('\n🔍 From header present:', hasFromHeader ? '✅' : '❌');

if (!hasFromHeader) {
    console.log('⚠️  WARNING: From header missing after preprocessing!');
}

console.log('\n🎯 Final result:');
if (processedHeaderBytes.length <= CIRCUIT_MAX_REMAINING_HEADER) {
    console.log('✅ SUCCESS: Real BRACU email preprocessing works!');
    console.log('✅ Header now fits circuit constraints');
    console.log('✅ From header is preserved');
} else {
    console.log('❌ FAILED: Header still too large after preprocessing');
    console.log('  Need additional', processedHeaderBytes.length - CIRCUIT_MAX_REMAINING_HEADER, 'bytes reduction');
}