const fs = require('fs');
const path = require('path');

// Load the real BRACU email
const emailPath = path.join(__dirname, 'Final Exam Schedule, Fall 2025.eml');
const rawEmail = fs.readFileSync(emailPath, 'utf8');

console.log('🧪 Debugging browser preprocessing...');
console.log('');

// Step 1: Extract header
const headerEnd = rawEmail.indexOf('\r\n\r\n');
const headerStr = rawEmail.substring(0, headerEnd);
console.log('📋 Step 1: Raw header analysis...');
console.log(`   Header size: ${headerStr.length} bytes`);

// Step 2: Apply CORRECTED browser preprocessing logic
console.log('📋 Step 2: Applying CORRECTED browser preprocessing...');

// Convert to bytes and back (simulate what browser does)
const headerBytes = new TextEncoder().encode(headerStr);
const lines = headerStr.split(/\r?\n/);

// Headers to keep (essential for verification)
const essentialHeaders = [
    'from:', 'to:', 'subject:', 'date:', 'message-id:'
];

// Filter essential headers and remove others
const processedLines = lines.filter(line => {
    const headerName = line.split(':')[0].toLowerCase() + ':';
    return essentialHeaders.some(h => headerName.startsWith(h));
});

// Smart truncation that preserves email addresses - CORRECTED
const truncatedLines = processedLines.map(line => {
    const colonIndex = line.indexOf(':');
    const headerName = line.substring(0, colonIndex + 1);
    let headerValue = line.substring(colonIndex + 1);
    
    // Special handling for From header to preserve email address
    if (headerName.toLowerCase() === 'from:') {
        // Extract email address using regex
        const emailMatch = headerValue.match(/<([^>]+)>/);
        if (emailMatch) {
            const emailAddress = emailMatch[1];
            // Match test format exactly: "from:email@domain.com" (34 chars total)
            // Pad email to exactly 29 characters to match circuit expectations
            // The format should be: "from:" (5 chars) + email (29 chars) = 34 chars total
            const paddedEmail = emailAddress.padEnd(29, ' ');
            return headerName.toLowerCase() + paddedEmail;
        }
    }
    
    // For other headers, be very aggressive
    const maxLength = headerName.toLowerCase() === 'to:' ? 30 : 25; // Even more aggressive for non-essential headers
    if (line.length > maxLength) {
        const availableSpace = maxLength - headerName.length - 3;
        const truncatedValue = headerValue.substring(0, Math.max(1, availableSpace)) + '...';
        return headerName + truncatedValue;
    }
    return line;
});

const processedHeader = truncatedLines.join('\n');
console.log(`   Processed header: "${processedHeader}"`);
console.log(`   Processed header size: ${processedHeader.length} bytes`);

// Step 3: Find exact indices - FIXED for lowercase
console.log('📋 Step 3: Finding exact indices...');

// Find From header (case-insensitive) - FIXED to handle space correctly
const fromMatch = processedHeader.match(/^from:(.*)$/im);
if (fromMatch) {
    const headerIndex = fromMatch.index || 0;
    const headerLength = fromMatch[0].length;
    
    // Find email address within From header - FIXED to handle padded spaces
    const emailPart = fromMatch[1];
    const emailAddress = emailPart.trim(); // Remove padding spaces
    const addressIndexInHeader = fromMatch[0].indexOf(emailAddress);
    const addressIndex = headerIndex + addressIndexInHeader;
    const addressLength = emailAddress.length;
    
    console.log(`   From header: "${fromMatch[0]}"`);
    console.log(`   Header index: ${headerIndex}`);
    console.log(`   Header length: ${headerLength}`);
    console.log(`   Email address: "${emailAddress}"`);
    console.log(`   Address index: ${addressIndex}`);
    console.log(`   Address length: ${addressLength}`);
    
    // Step 4: Compare with circuit expectations
    console.log('');
    console.log('📋 Step 4: Comparing with circuit expectations...');
    console.log('   Expected (from test):');
    console.log('     Header index: 0');
    console.log('     Header length: 34');
    console.log('     Address index: 5');
    console.log('     Address length: 29');
    console.log('');
    console.log('   Actual (from preprocessing):');
    console.log(`     Header index: ${headerIndex}`);
    console.log(`     Header length: ${headerLength}`);
    console.log(`     Address index: ${addressIndex}`);
    console.log(`     Address length: ${addressLength}`);
    
    // Check for mismatches
    const mismatches = [];
    if (headerLength !== 34) mismatches.push(`header length (${headerLength} ≠ 34)`);
    if (addressIndex !== 5) mismatches.push(`address index (${addressIndex} ≠ 5)`);
    if (addressLength !== 29) mismatches.push(`address length (${addressLength} ≠ 29)`);
    
    if (mismatches.length > 0) {
        console.log('');
        console.log('❌ Mismatches found:');
        mismatches.forEach(m => console.log(`   - ${m}`));
        
        // Show what the correct format should be
        console.log('');
        console.log('📝 Correct format should be:');
        console.log('   "from:bracu-student@g.bracu.ac.bd" (34 chars total)');
        console.log('   Email should be padded to exactly 29 characters');
        
        // Step 5: Show what we need to fix
        console.log('');
        console.log('🔧 Fix needed:');
        console.log('   Need to adjust preprocessing to match circuit expectations exactly');
        console.log('   Header should be exactly 34 characters');
        console.log('   Email should start at index 5 and be exactly 29 characters');
    } else {
        console.log('');
        console.log('✅ All values match circuit expectations!');
    }
} else {
    console.log('   ❌ From header not found in processed header');
    console.log('   Available headers:');
    processedHeader.split('\n').forEach((line, i) => {
        console.log(`     ${i}: "${line}"`);
    });
}

console.log('');
console.log('🔍 Debug complete!');