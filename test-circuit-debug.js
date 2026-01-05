// Test script to debug the circuit overflow issue
const fs = require('fs');

// Read the actual email content
const emailContent = fs.readFileSync('c:\\Users\\Administrator\\Desktop\\ZK\\myemail.ini', 'utf8');

console.log('=== EMAIL CONTENT ===');
console.log(emailContent);
console.log('=== EMAIL LENGTH ===');
console.log(`Total length: ${emailContent.length}`);

// Extract From header manually
const fromMatch = emailContent.match(/^From: (.+)$/m);
if (fromMatch) {
    console.log('=== FROM HEADER ===');
    console.log(`From: ${fromMatch[1]}`);
    
    // Find the email address within the From header
    const emailMatch = fromMatch[1].match(/<([^>]+)>/);
    if (emailMatch) {
        console.log('=== EMAIL ADDRESS ===');
        console.log(`Email: ${emailMatch[1]}`);
        console.log(`Email length: ${emailMatch[1].length}`);
        
        // Check if it's a BRACU email
        if (emailMatch[1].endsWith('@g.bracu.ac.bd')) {
            console.log('✅ Valid BRACU email');
        } else {
            console.log('❌ Not a BRACU email');
        }
    } else {
        console.log('❌ Could not extract email address from From header');
    }
} else {
    console.log('❌ Could not find From header');
}