// Test header truncation
const fs = require('fs');

// Read the actual email content
const emailContent = fs.readFileSync('d:\\RateZ\\Final Exam Schedule, Fall 2025.eml', 'utf8');

// Extract header
const headerString = emailContent.split('\n\n')[0];
const emailAddress = 'bracu-student@g.bracu.ac.bd';

console.log('=== Testing header truncation ===');
console.log('Original header length:', headerString.length);

// Test truncation to 2560
const maxHeaderLength = 2560;
let truncatedHeader = headerString;

if (headerString.length > maxHeaderLength) {
  truncatedHeader = headerString.substring(0, maxHeaderLength);
  console.log('Truncated header length:', truncatedHeader.length);
}

// Test findFromIndices on truncated header
function findFromIndices(headerString, emailAddress) {
  // Find "from:" in header (case-insensitive search, but we need exact position)
  // Handle both cases: header starting with "From:" or having a newline before it
  const fromPattern = /^from:/i
  const fromPatternWithNewline = /\r?\nfrom:/i
  
  let fromMatch = headerString.match(fromPattern)
  let headerIndex = 0
  let headerLength = 0

  if (fromMatch && fromMatch.index !== undefined) {
    // From header is at the beginning
    console.log('Found From at beginning, index:', fromMatch.index);
    headerIndex = 0
  } else {
    // Look for From header with newline
    fromMatch = headerString.match(fromPatternWithNewline)
    if (fromMatch && fromMatch.index !== undefined) {
      console.log('Found From with newline, index:', fromMatch.index);
      headerIndex = fromMatch.index + (fromMatch[0].startsWith('\r') ? 2 : 1) // Skip the newline
    } else {
      throw new Error('Could not find "From:" header in email')
    }
  }

  // Find end of From header (next CRLF not followed by whitespace)
  const afterFrom = headerString.slice(headerIndex)
  const headerEndMatch = afterFrom.match(/\r?\n(?![^\S\r\n])/)
  headerLength = headerEndMatch?.index || afterFrom.length

  console.log('Header index:', headerIndex);
  console.log('Header length:', headerLength);

  // Extract just the From header content for searching
  const fromHeaderContent = headerString.slice(headerIndex, headerIndex + headerLength)
  console.log('From header content length:', fromHeaderContent.length);
  console.log('From header content:', fromHeaderContent);

  // Find email address position WITHIN the From header only
  const addressLower = emailAddress.toLowerCase()
  const fromHeaderLower = fromHeaderContent.toLowerCase()
  const addressPosInFromHeader = fromHeaderLower.indexOf(addressLower)

  console.log('Address position in From header:', addressPosInFromHeader);

  if (addressPosInFromHeader < 0) {
    throw new Error(`Could not find email address "${emailAddress}" in From header. Found From header content: ${fromHeaderContent.substring(0, 100)}...`)
  }

  // Calculate absolute position in the full header string
  const addressPos = headerIndex + addressPosInFromHeader

  return {
    headerIndex,
    headerLength,
    addressIndex: addressPos,
    addressLength: emailAddress.length
  }
}

try {
  console.log('\n--- Testing on truncated header ---');
  const result = findFromIndices(truncatedHeader, emailAddress);
  console.log('Success on truncated:', result);
} catch (error) {
  console.log('Error on truncated header:', error.message);
  
  // Let's see what's in the truncated header
  console.log('\n--- Last 200 chars of truncated header ---');
  console.log(truncatedHeader.slice(-200));
  
  console.log('\n--- Does truncated header contain From header? ---');
  const hasFrom = truncatedHeader.toLowerCase().includes('from:');
  console.log('Contains From:', hasFrom);
  
  if (hasFrom) {
    const fromIndex = truncatedHeader.toLowerCase().indexOf('from:');
    console.log('From index:', fromIndex);
    console.log('From context:', truncatedHeader.slice(Math.max(0, fromIndex - 50), fromIndex + 100));
  }
}