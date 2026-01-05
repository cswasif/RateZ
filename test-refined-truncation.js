// Test refined smart header truncation
const fs = require('fs');

// Read the actual email content
const emailContent = fs.readFileSync('d:\\RateZ\\Final Exam Schedule, Fall 2025.eml', 'utf8');

// Extract header
const headerString = emailContent.split('\n\n')[0];
const emailAddress = 'bracu-student@g.bracu.ac.bd';

console.log('=== Testing refined smart header truncation ===');
console.log('Original header length:', headerString.length);

function refinedSmartTruncateHeader(headerString, emailAddress, maxLength = 2560) {
  if (headerString.length <= maxLength) {
    return headerString;
  }
  
  // Find the From header
  const lines = headerString.split('\n');
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
  
  console.log('Found From line at index:', fromLineIndex);
  console.log('From line:', fromLine);
  
  // Calculate the position of the From header in the original string
  let fromHeaderStart = 0;
  for (let i = 0; i < fromLineIndex; i++) {
    fromHeaderStart += lines[i].length + 1; // +1 for newline
  }
  
  // Find the end of the From header (next line that doesn't start with whitespace)
  let fromHeaderEnd = fromHeaderStart + fromLine.length;
  for (let i = fromLineIndex + 1; i < lines.length; i++) {
    if (lines[i].match(/^[^\s]/)) { // Line doesn't start with whitespace
      break;
    }
    fromHeaderEnd += lines[i].length + 1;
  }
  
  console.log('From header start:', fromHeaderStart);
  console.log('From header end:', fromHeaderEnd);
  console.log('From header length:', fromHeaderEnd - fromHeaderStart);
  
  // Calculate how much we need to remove from the beginning
  const fromHeaderLength = fromHeaderEnd - fromHeaderStart;
  const maxPrefixLength = maxLength - fromHeaderLength - 10; // Leave some buffer
  
  if (maxPrefixLength < 0) {
    // The From header itself is too long, we need to truncate it
    console.log('From header is too long, need to truncate within it');
    
    // Keep only the essential part of the From header
    const maxFromLength = Math.min(fromHeaderLength, maxLength - 100); // Reserve space for other headers
    const truncatedFrom = headerString.substring(fromHeaderStart, fromHeaderStart + maxFromLength);
    
    // Add some context before and after
    const startPos = Math.max(0, fromHeaderStart - 50);
    const endPos = Math.min(headerString.length, fromHeaderEnd + 50);
    
    let result = headerString.substring(startPos, endPos);
    
    // If still too long, truncate more aggressively
    if (result.length > maxLength) {
      result = result.substring(result.length - maxLength);
    }
    
    return result;
  }
  
  // Find the best truncation point before the From header
  let truncatePoint = 0;
  let currentLength = 0;
  
  for (let i = 0; i < fromLineIndex; i++) {
    const lineLength = lines[i].length + 1; // +1 for newline
    if (currentLength + lineLength > maxPrefixLength) {
      // This line would put us over the limit, truncate before it
      break;
    }
    currentLength += lineLength;
    truncatePoint = currentLength;
  }
  
  console.log('Truncate point:', truncatePoint);
  console.log('Max prefix length:', maxPrefixLength);
  
  // Remove from the beginning and include the From header
  const prefix = headerString.substring(truncatePoint, fromHeaderStart);
  const fromHeader = headerString.substring(fromHeaderStart, fromHeaderEnd);
  
  // Add some suffix after the From header if there's space
  const remainingSpace = maxLength - prefix.length - fromHeader.length;
  let suffix = '';
  
  if (remainingSpace > 0 && fromHeaderEnd < headerString.length) {
    suffix = headerString.substring(fromHeaderEnd, Math.min(headerString.length, fromHeaderEnd + remainingSpace));
  }
  
  const result = prefix + fromHeader + suffix;
  console.log('Result length:', result.length);
  
  return result.substring(0, maxLength); // Ensure we don't exceed limit
}

try {
  const refinedTruncated = refinedSmartTruncateHeader(headerString, emailAddress, 2560);
  console.log('\nRefined truncated header length:', refinedTruncated.length);
  
  // Test if From header is still there
  const hasFrom = refinedTruncated.toLowerCase().includes('from:');
  console.log('Contains From header:', hasFrom);
  
  if (hasFrom) {
    const fromIndex = refinedTruncated.toLowerCase().indexOf('from:');
    console.log('From index in truncated:', fromIndex);
    
    // Show the From context
    const fromContext = refinedTruncated.slice(Math.max(0, fromIndex - 50), fromIndex + 200);
    console.log('From context:', fromContext);
  }
  
  // Test findFromIndices on the refined truncated header
  function findFromIndices(headerString, emailAddress) {
    const fromPattern = /^from:/i
    const fromPatternWithNewline = /\r?\nfrom:/i
    
    let fromMatch = headerString.match(fromPattern)
    let headerIndex = 0
    let headerLength = 0

    if (fromMatch && fromMatch.index !== undefined) {
      headerIndex = 0
    } else {
      fromMatch = headerString.match(fromPatternWithNewline)
      if (fromMatch && fromMatch.index !== undefined) {
        headerIndex = fromMatch.index + (fromMatch[0].startsWith('\r') ? 2 : 1)
      } else {
        throw new Error('Could not find "From:" header in email')
      }
    }

    const afterFrom = headerString.slice(headerIndex)
    const headerEndMatch = afterFrom.match(/\r?\n(?![^\S\r\n])/)
    headerLength = headerEndMatch?.index || afterFrom.length

    const fromHeaderContent = headerString.slice(headerIndex, headerIndex + headerLength)
    const addressLower = emailAddress.toLowerCase()
    const fromHeaderLower = fromHeaderContent.toLowerCase()
    const addressPosInFromHeader = fromHeaderLower.indexOf(addressLower)

    if (addressPosInFromHeader < 0) {
      throw new Error(`Could not find email address "${emailAddress}" in From header`)
    }

    const addressPos = headerIndex + addressPosInFromHeader

    return {
      headerIndex,
      headerLength,
      addressIndex: addressPos,
      addressLength: emailAddress.length
    }
  }
  
  const result = findFromIndices(refinedTruncated, emailAddress);
  console.log('\nfindFromIndices success:', result);
  
} catch (error) {
  console.log('Error:', error.message);
}