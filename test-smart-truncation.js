// Test smart header truncation that preserves From header
const fs = require('fs');

// Read the actual email content
const emailContent = fs.readFileSync('d:\\RateZ\\Final Exam Schedule, Fall 2025.eml', 'utf8');

// Extract header
const headerString = emailContent.split('\n\n')[0];
const emailAddress = 'bracu-student@g.bracu.ac.bd';

console.log('=== Testing smart header truncation ===');
console.log('Original header length:', headerString.length);

function smartTruncateHeader(headerString, emailAddress, maxLength = 2560) {
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
  
  // If the From header is already within the first maxLength characters, just truncate normally
  if (fromHeaderEnd <= maxLength) {
    console.log('From header fits within limit, truncating normally');
    return headerString.substring(0, maxLength);
  }
  
  // If the From header is beyond maxLength, we need to shift it
  console.log('From header is beyond limit, need to shift');
  
  // Calculate how much we need to remove from the beginning
  const excessLength = fromHeaderEnd - maxLength;
  
  // Find a good truncation point (end of a header line)
  let truncatePoint = 0;
  let currentLength = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const lineLength = lines[i].length + 1; // +1 for newline
    if (currentLength + lineLength > excessLength) {
      // This line would put us over the excess, truncate before it
      break;
    }
    currentLength += lineLength;
    truncatePoint = currentLength;
  }
  
  console.log('Truncate point:', truncatePoint);
  console.log('Removing from beginning:', truncatePoint);
  
  // Remove from the beginning and return the truncated header
  const truncated = headerString.substring(truncatePoint);
  console.log('Truncated header length:', truncated.length);
  
  return truncated;
}

try {
  const smartTruncated = smartTruncateHeader(headerString, emailAddress, 2560);
  console.log('\nSmart truncated header length:', smartTruncated.length);
  
  // Test if From header is still there
  const hasFrom = smartTruncated.toLowerCase().includes('from:');
  console.log('Contains From header:', hasFrom);
  
  if (hasFrom) {
    const fromIndex = smartTruncated.toLowerCase().indexOf('from:');
    console.log('From index in truncated:', fromIndex);
    
    // Show the From context
    const fromContext = smartTruncated.slice(Math.max(0, fromIndex - 50), fromIndex + 200);
    console.log('From context:', fromContext);
  }
  
} catch (error) {
  console.log('Error:', error.message);
}