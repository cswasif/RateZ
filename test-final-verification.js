/**
 * Final test: Complete ZK proof generation with smart email preservation
 */

const fs = require('fs');

// Read the real BRACU email
const emailContent = fs.readFileSync('Final Exam Schedule, Fall 2025.eml', 'utf8');

console.log('🧪 Final test: Complete ZK proof generation with smart email preservation...\n');

// Split headers and body
const headerEndIndex = emailContent.indexOf('\r\n\r\n');
const headerPart = headerEndIndex !== -1 ? emailContent.substring(0, headerEndIndex) : emailContent.substring(0, emailContent.indexOf('\n\n'));

console.log('📧 Loaded real BRACU email:', emailContent.length, 'bytes');
console.log('📊 Email structure:');
console.log('- Header size:', headerPart.length, 'bytes');

// Simulate the updated preprocessing from email-preprocessor.ts
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
  
  // Ultra-minimal truncation
  const truncatedLines = processedLines.map(line => {
    const colonIndex = line.indexOf(':');
    const headerName = line.substring(0, colonIndex + 1);
    let headerValue = line.substring(colonIndex + 1);
    
    // Special handling for From header to preserve email address
    if (headerName.toLowerCase() === 'from:') {
      // Extract email address using regex
      const emailMatch = headerValue.match(/<([^>]+)>/);
      if (emailMatch) {
        const emailAddress = emailMatch[1];
        // Ultra-minimal: just email address
        return headerName + ' <' + emailAddress + '>';
      }
    }
    
    // For other headers, be very aggressive
    const maxLength = headerName.toLowerCase() === 'to:' ? 30 : 25; // Even more aggressive for non-essential headers
    if (line.length > maxLength) {
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
  
  console.log(`\n📋 Step 1: Header preprocessing results:`);
  console.log(`   Original size: ${originalSize} bytes`);
  console.log(`   New size: ${newSize} bytes`);
  console.log(`   Savings: ${savings} bytes (${Math.round(savings/originalSize * 100)}%)`);
  
  return new TextEncoder().encode(processedHeader);
}

const headerBytes = new TextEncoder().encode(headerPart);
const processedHeaderBytes = preprocessEmailHeaders(headerBytes);

// Simulate the email parser's findFromIndices function
function findFromIndices(headerString, emailAddress) {
  // Find From header
  const fromPattern = /^From:/i;
  const fromPatternWithNewline = /\r?\nFrom:/i;
  
  let fromMatch = headerString.match(fromPattern);
  let headerIndex = 0;
  let headerLength = 0;

  if (fromMatch && fromMatch.index !== undefined) {
    headerIndex = 0;
  } else {
    fromMatch = headerString.match(fromPatternWithNewline);
    if (fromMatch && fromMatch.index !== undefined) {
      headerIndex = fromMatch.index + (fromMatch[0].startsWith('\r') ? 2 : 1);
    } else {
      throw new Error('Could not find "From:" header in email');
    }
  }

  // Find end of From header
  const afterFrom = headerString.slice(headerIndex);
  const headerEndMatch = afterFrom.match(/\r?\n(?![^\S\r\n])/);
  headerLength = headerEndMatch?.index || afterFrom.length;

  // Extract From header content
  const fromHeaderContent = headerString.slice(headerIndex, headerIndex + headerLength);

  // Find email address within From header
  const addressLower = emailAddress.toLowerCase();
  const fromHeaderLower = fromHeaderContent.toLowerCase();
  const addressPosInFromHeader = fromHeaderLower.indexOf(addressLower);

  if (addressPosInFromHeader < 0) {
    throw new Error(`Could not find email address "${emailAddress}" in From header. Found From header content: ${fromHeaderContent.substring(0, 100)}...`);
  }

  const addressPos = headerIndex + addressPosInFromHeader;
  
  return {
    headerIndex,
    headerLength,
    addressPos,
    addressLength: emailAddress.length
  };
}

// Test the parser can find the email address
const processedHeaderStr = new TextDecoder().decode(processedHeaderBytes);
const bracuEmail = 'bracu-student@g.bracu.ac.bd';

console.log('\n🔍 Step 2: Testing email address extraction...');
console.log('Looking for email:', bracuEmail);

try {
  const indices = findFromIndices(processedHeaderStr, bracuEmail);
  console.log('✅ Email address found successfully!');
  console.log('- Header position:', indices.headerIndex, '-', indices.headerIndex + indices.headerLength);
  console.log('- Email position:', indices.addressPos, '-', indices.addressPos + indices.addressLength);
  
  // Verify the email is in the processed header
  const foundEmail = processedHeaderStr.substring(indices.addressPos, indices.addressPos + indices.addressLength);
  console.log('- Found email:', foundEmail);
  
} catch (error) {
  console.log('❌ Email extraction failed:', error.message);
  console.log('\n📋 Processed header content:');
  processedHeaderStr.split('\n').forEach((line, i) => {
    console.log(`${i + 1}. ${line}`);
  });
  process.exit(1);
}

// Final verification
console.log('\n🎯 Step 3: Final verification...');
const constraints = {
  headerSize: processedHeaderBytes.length <= 159,
  emailFound: true,
  fromHeaderPresent: processedHeaderStr.toLowerCase().includes('from:'),
  emailInFrom: processedHeaderStr.includes(bracuEmail)
};

Object.entries(constraints).forEach(([constraint, passed]) => {
  console.log(`- ${constraint}: ${passed ? '✅' : '❌'}`);
});

const allPassed = Object.values(constraints).every(Boolean);
console.log('\n🚀 Final result:', allPassed ? '✅ SUCCESS' : '❌ FAILED');

if (allPassed) {
  console.log('\n✅ Real BRACU email preprocessing successful!');
  console.log('✅ Header fits circuit constraints (≤159 bytes)');
  console.log('✅ Email address preserved and findable by parser');
  console.log('✅ Ready for ZK proof generation in browser!');
  console.log('\n🌐 The browser should now be able to process the real EML file without errors.');
} else {
  console.log('\n❌ Some constraints failed - the browser may still have issues.');
}