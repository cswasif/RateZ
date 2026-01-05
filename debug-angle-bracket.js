const fs = require('fs');
const path = require('path');

// Load the real BRACU email
const emailPath = path.join(__dirname, 'Final Exam Schedule, Fall 2025.eml');
const rawEmail = fs.readFileSync(emailPath, 'utf8');

console.log('🧪 Debugging angle bracket detection...');
console.log('');

// Step 1: Check the raw email structure
console.log('📋 Step 1: Raw email analysis...');
const headerEnd = rawEmail.indexOf('\r\n\r\n');
const header = rawEmail.substring(0, headerEnd);
console.log(`   Header size: ${header.length} bytes`);

// Find From header
const fromMatch = header.match(/^From: (.*)$/im);
if (fromMatch) {
    console.log(`   From header: "${fromMatch[0]}"`);
    console.log(`   From address: "${fromMatch[1]}"`);
} else {
    console.log('   ❌ From header not found');
    process.exit(1);
}
console.log('');

// Step 2: Simulate preprocessing
console.log('📋 Step 2: Simulating preprocessing...');
const lines = header.split('\r\n');
const processedLines = [];

for (const line of lines) {
    if (line.toLowerCase().startsWith('from:') || 
        line.toLowerCase().startsWith('to:') || 
        line.toLowerCase().startsWith('subject:') || 
        line.toLowerCase().startsWith('date:') || 
        line.toLowerCase().startsWith('message-id:')) {
        
        // Apply ultra-aggressive truncation (30 chars max)
        const maxLength = 30;
        if (line.length > maxLength) {
            const colonIndex = line.indexOf(':');
            const headerName = line.substring(0, colonIndex + 1);
            const headerValue = line.substring(colonIndex + 1);
            
            // Special handling for From header to preserve email address
            if (line.toLowerCase().startsWith('from:')) {
                const emailMatch = headerValue.match(/<([^>]+)>/);
                if (emailMatch) {
                    const emailAddress = emailMatch[1];
                    const minimalFrom = headerName + ' <' + emailAddress + '>';
                    processedLines.push(minimalFrom);
                    console.log(`   Processed From: "${minimalFrom}"`);
                    continue;
                }
            }
            
            // Truncate the value, keeping the header name intact
            const availableSpace = maxLength - headerName.length - 3;
            const truncatedValue = headerValue.substring(0, Math.max(1, availableSpace)) + '...';
            const truncatedLine = headerName + truncatedValue;
            processedLines.push(truncatedLine);
        } else {
            processedLines.push(line);
        }
    }
}

const processedHeader = processedLines.join('\r\n');
console.log(`   Processed header: "${processedHeader}"`);
console.log('');

// Step 3: Detailed angle bracket analysis
console.log('📋 Step 3: Angle bracket detection analysis...');
const fromHeader = 'From: <bracu-student@g.bracu.ac.bd>';
console.log(`   From header: "${fromHeader}"`);

// Find exact positions
const colonIndex = fromHeader.indexOf(':');
const angleBracketIndex = fromHeader.indexOf('<');
const emailStartIndex = angleBracketIndex + 1;
const emailEndIndex = fromHeader.indexOf('>');
const emailAddress = fromHeader.substring(emailStartIndex, emailEndIndex);

console.log(`   Colon position: ${colonIndex}`);
console.log(`   Angle bracket position: ${angleBracketIndex}`);
console.log(`   Email start position: ${emailStartIndex}`);
console.log(`   Email end position: ${emailEndIndex}`);
console.log(`   Email address: "${emailAddress}"`);
console.log(`   Email length: ${emailAddress.length}`);

// Check if this matches circuit expectations
console.log('');
console.log('📋 Step 4: Circuit constraint validation...');

// According to the circuit, if angle bracket is found:
// email_address_sequence.index should == last_angle_bracket + 1
const expectedEmailIndex = angleBracketIndex + 1;
const actualEmailIndex = emailStartIndex;

console.log(`   Expected email index (angle_bracket + 1): ${expectedEmailIndex}`);
console.log(`   Actual email index: ${actualEmailIndex}`);
console.log(`   Match: ${expectedEmailIndex === actualEmailIndex ? '✅' : '❌'}`);

// Header sequence should be the entire From header
const headerIndex = 0;
const headerLength = fromHeader.length;

console.log(`   Header index: ${headerIndex}`);
console.log(`   Header length: ${headerLength}`);

// Check if email is within header bounds
const emailWithinHeader = emailStartIndex >= headerIndex && emailEndIndex <= headerIndex + headerLength;
console.log(`   Email within header bounds: ${emailWithinHeader ? '✅' : '❌'}`);

console.log('');
console.log('🔍 Analysis complete!');

// Summary
if (expectedEmailIndex === actualEmailIndex && emailWithinHeader) {
    console.log('✅ Circuit constraints should be satisfied');
} else {
    console.log('❌ Circuit constraints will fail');
    if (expectedEmailIndex !== actualEmailIndex) {
        console.log('   - Email index mismatch with angle bracket position');
    }
    if (!emailWithinHeader) {
        console.log('   - Email not within header bounds');
    }
}