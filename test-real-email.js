const fs = require('fs');

// Read the real BRACU email
const emailContent = fs.readFileSync('Final Exam Schedule, Fall 2025.eml', 'utf8');

// Split headers and body - handle both \r\n and \n
const headerEndIndex = emailContent.indexOf('\r\n\r\n');
const headerPart = headerEndIndex !== -1 ? emailContent.substring(0, headerEndIndex) : emailContent.substring(0, emailContent.indexOf('\n\n'));
const headerBytes = new TextEncoder().encode(headerPart);

console.log('📧 Original email analysis:');
console.log('- Total email size:', emailContent.length, 'bytes');
console.log('- Header size:', headerBytes.length, 'bytes');

// Manual preprocessing with ultra-aggressive truncation
function preprocessEmailHeaders(headerBytes) {
  const headerStr = new TextDecoder().decode(headerBytes);
  const lines = headerStr.split(/\r?\n/);
  const essentialHeaders = ['from:', 'to:', 'subject:', 'date:', 'message-id:'];
  
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
  
  return new TextEncoder().encode(truncatedLines.join('\n'));
}

// Test preprocessing
console.log('\n🔧 Testing ultra-aggressive preprocessing...');
const processedHeaderBytes = preprocessEmailHeaders(headerBytes);
console.log('- Processed header size:', processedHeaderBytes.length, 'bytes');
console.log('- Size reduction:', headerBytes.length - processedHeaderBytes.length, 'bytes');
console.log('- Reduction percentage:', Math.round(((headerBytes.length - processedHeaderBytes.length) / headerBytes.length) * 100), '%');

// Check circuit constraints
const CIRCUIT_MAX_REMAINING_HEADER = 159;
console.log('\n⚡ Circuit analysis:');
console.log('- Circuit max remaining header:', CIRCUIT_MAX_REMAINING_HEADER, 'bytes');
console.log('- Original header fits:', headerBytes.length <= CIRCUIT_MAX_REMAINING_HEADER ? '✅' : '❌');
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

console.log('\n📊 Summary:');
if (processedHeaderBytes.length <= CIRCUIT_MAX_REMAINING_HEADER) {
    console.log('✅ Preprocessing successful - header now fits circuit constraints!');
} else {
    console.log('❌ Header still too large after preprocessing');
    console.log('  Need additional', processedHeaderBytes.length - CIRCUIT_MAX_REMAINING_HEADER, 'bytes reduction');
    
    // Try even more aggressive truncation
    console.log('\n🔧 Trying even more aggressive truncation...');
    const ultraProcessedLines = keptHeaders.map(line => {
        const maxLength = 20; // Max 20 chars per header (extremely aggressive)
        if (line.length > maxLength) {
            const colonIndex = line.indexOf(':');
            const headerName = line.substring(0, colonIndex + 1);
            const availableSpace = maxLength - headerName.length - 3;
            const headerValue = line.substring(colonIndex + 1);
            const truncatedValue = headerValue.substring(0, Math.max(1, availableSpace)) + '...';
            return headerName + truncatedValue;
        }
        return line;
    });
    
    const ultraProcessedHeaderBytes = new TextEncoder().encode(ultraProcessedLines.join('\n'));
    console.log('- Ultra-processed header size:', ultraProcessedHeaderBytes.length, 'bytes');
    console.log('- Ultra-processed header fits:', ultraProcessedHeaderBytes.length <= CIRCUIT_MAX_REMAINING_HEADER ? '✅' : '❌');
    
    if (ultraProcessedHeaderBytes.length <= CIRCUIT_MAX_REMAINING_HEADER) {
        console.log('✅ Ultra-aggressive preprocessing successful!');
        console.log('\n📋 Ultra-processed headers:');
        ultraProcessedLines.forEach(header => {
            console.log('  -', header);
        });
    }
}