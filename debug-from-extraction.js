// Debug script to test From header extraction
const fs = require('fs');

// Read the actual email file
const emailContent = fs.readFileSync('Final Exam Schedule, Fall 2025.eml', 'utf8');

console.log('=== EMAIL CONTENT PREVIEW ===');
console.log(emailContent.substring(0, 1000));
console.log('...');

console.log('\n=== SEARCHING FOR FROM HEADER ===');

// Test different regex patterns
const patterns = [
    /^from:/i,
    /\r?\nfrom:/i,
    /from:/i,
    /^From:/,
    /\nFrom:/,
    /\r\nFrom:/
];

patterns.forEach((pattern, index) => {
    const match = emailContent.match(pattern);
    console.log(`Pattern ${index + 1}: ${pattern}`);
    console.log(`Match: ${match ? 'FOUND' : 'NOT FOUND'}`);
    if (match) {
        console.log(`Index: ${match.index}`);
        console.log(`Match content: "${match[0]}"`);
        console.log(`Context: "${emailContent.substring(Math.max(0, match.index - 20), match.index + 50)}"`);
    }
    console.log('---');
});

// Test line-by-line search
console.log('\n=== LINE-BY-LINE SEARCH ===');
const lines = emailContent.split(/\r?\n/);
lines.forEach((line, index) => {
    if (line.toLowerCase().includes('from:')) {
        console.log(`Line ${index + 1}: "${line}"`);
    }
});

// Test the exact function logic
console.log('\n=== TESTING EXTRACT FUNCTION LOGIC ===');
function extractFromAddress(rawEmail) {
    const lines = rawEmail.split(/\r?\n/);
    
    for (const line of lines) {
        if (line.toLowerCase().startsWith('from:')) {
            console.log(`Found From line: "${line}"`);
            // Extract email address (handles "Name <email>" and "email" formats)
            const emailMatch = line.match(/<([^>]+)>/) || line.match(/:\s*([^\s<]+@[^\s>]+)/);
            if (emailMatch) {
                const address = emailMatch[1].toLowerCase();
                const domainMatch = address.match(/@(.+)$/);
                console.log(`Extracted address: "${address}"`);
                console.log(`Extracted domain: "${domainMatch ? domainMatch[1] : ''}"`);
                return {
                    fromAddress: address,
                    fromDomain: domainMatch ? domainMatch[1] : ''
                };
            }
        }
    }
    
    throw new Error('Could not find From address in email');
}

try {
    const result = extractFromAddress(emailContent);
    console.log('SUCCESS:', result);
} catch (error) {
    console.log('ERROR:', error.message);
}