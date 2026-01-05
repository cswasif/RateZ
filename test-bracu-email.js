const fs = require('fs');
const path = require('path');

// Read the BRACU email file
const emailPath = path.join(__dirname, 'myemail.ini');
const emailContent = fs.readFileSync(emailPath, 'utf8');

console.log('Testing BRACU email parsing...');
console.log('Email content length:', emailContent.length);

// Extract From header
const fromMatch = emailContent.match(/^From: (.+)$/m);
if (fromMatch) {
    console.log('From header:', fromMatch[1]);
    
    // Extract email address
    const emailMatch = fromMatch[1].match(/<([^>]+)>/);
    if (emailMatch) {
        const email = emailMatch[1];
        console.log('Email address:', email);
        console.log('Email length:', email.length);
        
        // Check if it's a BRACU email
        if (email.endsWith('@g.bracu.ac.bd')) {
            console.log('✅ Valid BRACU email domain');
            
            // Calculate the minimum length for BRACU domain
            const bracuDomainLen = 13; // g.bracu.ac.bd
            const minLength = bracuDomainLen + 2; // 1 char + @ + 13 char domain
            console.log('BRACU domain length:', bracuDomainLen);
            console.log('Minimum required length:', minLength);
            console.log('Actual email length:', email.length);
            console.log('Length validation:', email.length >= minLength ? '✅ PASS' : '❌ FAIL');
        } else {
            console.log('❌ Not a BRACU email domain');
        }
    } else {
        console.log('❌ Could not extract email address from From header');
    }
} else {
    console.log('❌ Could not find From header');
}

// Test the circuit input validation logic
console.log('\n--- Testing circuit validation logic ---');
const testEmail = 'test.user@g.bracu.ac.bd';
console.log('Test email:', testEmail);
console.log('Test email length:', testEmail.length);

const bracuDomainLen = 13; // g.bracu.ac.bd
const minLength = bracuDomainLen + 2; // 1 char + @ + 13 char domain
console.log('Minimum required length:', minLength);
console.log('Validation result:', testEmail.length >= minLength ? '✅ PASS' : '❌ FAIL');