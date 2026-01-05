const fs = require('fs');

// Read the actual email file
const emailContent = fs.readFileSync('Final Exam Schedule, Fall 2025.eml', 'utf-8');

// Extract header and body
const headerEndIndex = emailContent.indexOf('\r\n\r\n');
const header = emailContent.substring(0, headerEndIndex);
const body = emailContent.substring(headerEndIndex + 4);

console.log('🧪 Debugging circuit input values...');
console.log('');

// Step 1: Find From header
const fromMatch = header.match(/^From: (.*)$/m);
if (!fromMatch) {
    console.log('❌ From header not found');
    process.exit(1);
}

const fromHeaderLine = fromMatch[0];
const fromHeaderValue = fromMatch[1];

console.log('📋 Step 1: From header analysis');
console.log(`   From header: "${fromHeaderLine}"`);
console.log(`   From value: "${fromHeaderValue}"`);

// Step 2: Find email address in From header
const emailMatch = fromHeaderValue.match(/<([^>]+)>/);
if (!emailMatch) {
    console.log('❌ Email address not found in From header');
    process.exit(1);
}

const emailAddress = emailMatch[1];
console.log(`   Email address: "${emailAddress}"`);

// Step 3: Calculate indices in the raw header
const fromHeaderIndex = header.indexOf(fromHeaderLine);
const emailStartIndex = header.indexOf(`<${emailAddress}>`, fromHeaderIndex);
const emailEndIndex = emailStartIndex + emailAddress.length;

console.log('');
console.log('📋 Step 2: Index calculation in raw header');
console.log(`   From header starts at: ${fromHeaderIndex}`);
console.log(`   Email starts at: ${emailStartIndex} (angle bracket position)`);
console.log(`   Email ends at: ${emailEndIndex}`);
console.log(`   Email length: ${emailAddress.length}`);

// Step 4: Simulate preprocessing
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
        }
    }
}

// Join processed lines
const processedHeader = processedLines.join('\r\n');
console.log('');
console.log('📋 Step 3: Processed header');
console.log(`   Processed header: "${processedHeader}"`);

// Step 5: Recalculate indices in processed header
const processedFromIndex = processedHeader.indexOf('From:');
const processedEmailStart = processedHeader.indexOf(`<${emailAddress}>`, processedFromIndex);

console.log('');
console.log('📋 Step 4: Index calculation in processed header');
console.log(`   From header index in processed: ${processedFromIndex}`);
console.log(`   Email start index in processed: ${processedEmailStart}`);
console.log(`   Email address length: ${emailAddress.length}`);

// Step 6: Check if values fit in u32
console.log('');
console.log('📋 Step 5: Bit size validation');
console.log(`   From header index: ${processedFromIndex} (fits in u32: ${processedFromIndex < 2**32})`);
console.log(`   From header length: ${'From: <bracu-student@g.bracu.ac.bd>'.length} (fits in u32: ${'From: <bracu-student@g.bracu.ac.bd>'.length < 2**32})`);
console.log(`   From address index: ${processedEmailStart} (fits in u32: ${processedEmailStart < 2**32})`);
console.log(`   From address length: ${emailAddress.length} (fits in u32: ${emailAddress.length < 2**32})`);

// Step 7: Compare with test values
console.log('');
console.log('📋 Step 6: Comparison with test values');
console.log(`   Test From header index: 0 (actual: ${processedFromIndex})`);
console.log(`   Test From header length: 34 (actual: ${'From: <bracu-student@g.bracu.ac.bd>'.length})`);
console.log(`   Test From address index: 5 (actual: ${processedEmailStart})`);
console.log(`   Test From address length: 29 (actual: ${emailAddress.length})`);

// Step 8: Check for potential issues
console.log('');
console.log('📋 Step 7: Potential issues');
if (processedEmailStart !== 5) {
    console.log(`   ⚠️  Address index mismatch: expected 5, got ${processedEmailStart}`);
}
if (emailAddress.length !== 29) {
    console.log(`   ⚠️  Address length mismatch: expected 29, got ${emailAddress.length}`);
}

console.log('');
console.log('🔍 Analysis complete!');