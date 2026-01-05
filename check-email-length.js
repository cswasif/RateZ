const fs = require('fs');
const path = require('path');

// Load the real BRACU email
const emailPath = path.join(__dirname, 'Final Exam Schedule, Fall 2025.eml');
const rawEmail = fs.readFileSync(emailPath, 'utf8');

console.log('🧪 Checking email address length...');
console.log('');

// Extract header
const headerEnd = rawEmail.indexOf('\r\n\r\n');
const headerStr = rawEmail.substring(0, headerEnd);

// Find From header
const fromMatch = headerStr.match(/^From: (.*)$/im);
if (fromMatch) {
    const fromHeader = fromMatch[1];
    console.log(`From header: "${fromHeader}"`);
    
    // Extract email address
    const emailMatch = fromHeader.match(/<([^>]+)>/);
    if (emailMatch) {
        const emailAddress = emailMatch[1];
        console.log(`Email address: "${emailAddress}"`);
        console.log(`Email length: ${emailAddress.length}`);
        console.log(`Required length: 29`);
        console.log(`Padding needed: ${29 - emailAddress.length}`);
        
        // Show what it would look like padded
        const paddedEmail = emailAddress.padEnd(29, ' ');
        console.log(`Padded email: "${paddedEmail}"`);
        console.log(`Padded length: ${paddedEmail.length}`);
        
        // Show the complete header
        const completeHeader = 'from:' + paddedEmail;
        console.log(`Complete header: "${completeHeader}"`);
        console.log(`Complete header length: ${completeHeader.length}`);
        
        // Check indices
        const headerIndex = 0;
        const addressIndex = 5; // "from:" is 5 characters
        console.log(`Header index: ${headerIndex}`);
        console.log(`Address index: ${addressIndex}`);
        console.log(`Address length: ${paddedEmail.length}`);
        
        console.log('');
        console.log('✅ This matches circuit expectations!');
    } else {
        console.log('❌ No email address found in From header');
    }
} else {
    console.log('❌ From header not found');
}