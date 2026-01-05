// Test with the actual email format from the file
const fs = require('fs');

// Read the actual email content
const emailContent = fs.readFileSync('d:\\RateZ\\Final Exam Schedule, Fall 2025.eml', 'utf8');

console.log('=== Testing with actual email file ===');
console.log('Email content length:', emailContent.length);

// Extract header
const headerOnly = emailContent.split('\n\n')[0];
console.log('\nHeader only length:', headerOnly.length);

// Find From header using different patterns
const fromPatterns = [
  /^from:\s*/i,                    // From: at start of line
  /\r?\nfrom:\s*/i,               // From: with newline
  /from:\s*"[^"]*"\s*<[^>]+>/i,   // From: "Name" <email>
  /from:\s*<[^>]+>/i              // From: <email>
];

let fromMatch = null;
let patternUsed = null;

for (const pattern of fromPatterns) {
  fromMatch = headerOnly.match(pattern);
  if (fromMatch) {
    patternUsed = pattern;
    console.log('Found From header with pattern:', pattern.toString());
    console.log('Match:', fromMatch[0]);
    console.log('Index:', fromMatch.index);
    break;
  }
}

if (!fromMatch) {
  console.log('ERROR: Could not find From header with any pattern');
  console.log('\nHeader content:');
  console.log(headerOnly.substring(0, 500));
  process.exit(1);
}

// Extract the full From line
const lines = headerOnly.split('\n');
let fromLine = null;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].toLowerCase().startsWith('from:')) {
    fromLine = lines[i];
    console.log('Found From line:', fromLine);
    break;
  }
}

if (!fromLine) {
  console.log('ERROR: Could not find From line in split headers');
  process.exit(1);
}

// Extract email address
const emailMatch = fromLine.match(/<([^>]+)>/);
const emailAddress = emailMatch ? emailMatch[1] : fromLine.split(':')[1].trim();
console.log('Email address:', emailAddress);

// Find email in header
const addressLower = emailAddress.toLowerCase();
const headerLower = headerOnly.toLowerCase();
const addressIndex = headerLower.indexOf(addressLower);
console.log('Email index in header:', addressIndex);

// Check if it's a BRACU email
const isBracuEmail = emailAddress.endsWith('@g.bracu.ac.bd') || emailAddress.endsWith('@bracu.ac.bd');
console.log('Is BRACU email:', isBracuEmail);

// Test header truncation
const maxHeaderLength = 2560;
if (headerOnly.length > maxHeaderLength) {
  console.log(`Header length ${headerOnly.length} exceeds maximum ${maxHeaderLength}`);
  const truncated = headerOnly.substring(0, maxHeaderLength);
  console.log('Truncated header length:', truncated.length);
} else {
  console.log(`Header length ${headerOnly.length} is within limit`);
}