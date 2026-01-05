// Test the current findFromIndices logic
const fs = require('fs');

// Read the actual email content
const emailContent = fs.readFileSync('d:\\RateZ\\Final Exam Schedule, Fall 2025.eml', 'utf8');

// Extract header
const headerString = emailContent.split('\n\n')[0];
const emailAddress = 'bracu-student@g.bracu.ac.bd';

console.log('=== Testing findFromIndices logic ===');
console.log('Header length:', headerString.length);
console.log('Email address:', emailAddress);

// Test the current logic
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
  const result = findFromIndices(headerString, emailAddress);
  console.log('Success:', result);
} catch (error) {
  console.log('Error:', error.message);
  
  // Let's debug by finding all From-like patterns
  console.log('\n=== Debugging: Finding all From patterns ===');
  const allFromMatches = headerString.match(/from:/gi);
  console.log('All From matches:', allFromMatches);
  
  // Find the actual From line
  const lines = headerString.split('\n');
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes('from:')) {
      console.log(`Line ${index}: ${line}`);
    }
  });
}