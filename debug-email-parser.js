// Debug script to test email parsing
const fs = require('fs');

// Test with different email formats
const testEmails = [
  {
    name: "Simple email",
    content: `From: Test User <test.user@g.bracu.ac.bd>
To: recipient@example.com
Subject: Test

Body content`
  },
  {
    name: "Email with CRLF",
    content: `From: Test User <test.user@g.bracu.ac.bd>
To: recipient@example.com
Subject: Test

Body content`
  },
  {
    name: "Email with From at beginning",
    content: `From: Test User <test.user@g.bracu.ac.bd>
To: recipient@example.com
Subject: Test

Body content`
  }
];

function testEmailParsing(email, name) {
  console.log(`\n=== Testing: ${name} ===`);
  console.log('Full email:');
  console.log(email);
  
  // Extract header
  const headerOnly = email.split('\n\n')[0];
  console.log('\nHeader only:');
  console.log(headerOnly);
  console.log('Header length:', headerOnly.length);
  
  // Test From header finding
  const fromPattern = /^from:/i;
  const fromPatternWithNewline = /\r?\nfrom:/i;
  
  let fromMatch = headerOnly.match(fromPattern);
  let headerIndex = 0;
  
  if (fromMatch && fromMatch.index !== undefined) {
    console.log('Found From at beginning, index:', fromMatch.index);
    headerIndex = 0;
  } else {
    fromMatch = headerOnly.match(fromPatternWithNewline);
    if (fromMatch && fromMatch.index !== undefined) {
      console.log('Found From with newline, index:', fromMatch.index);
      headerIndex = fromMatch.index + (fromMatch[0].startsWith('\r') ? 2 : 1);
    } else {
      console.log('ERROR: Could not find From header');
      return false;
    }
  }
  
  console.log('Header index:', headerIndex);
  
  // Find email address
  const fromHeader = headerOnly.split('\n').find(line => line.toLowerCase().startsWith('from:'));
  console.log('From header line:', fromHeader);
  
  const emailMatch = fromHeader.match(/<([^>]+)>/);
  const emailAddress = emailMatch ? emailMatch[1] : fromHeader.split(':')[1].trim();
  console.log('Email address:', emailAddress);
  
  // Find email in header
  const addressLower = emailAddress.toLowerCase();
  const headerLower = headerOnly.toLowerCase();
  const addressIndex = headerLower.indexOf(addressLower);
  console.log('Email index in header:', addressIndex);
  
  return true;
}

testEmails.forEach(({name, content}) => {
  testEmailParsing(content, name);
});