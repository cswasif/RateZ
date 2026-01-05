const fs = require('fs');
const path = require('path');

// Load the real BRACU email
const emailPath = path.join(__dirname, 'Final Exam Schedule, Fall 2025.eml');
const rawEmail = fs.readFileSync(emailPath, 'utf8');

console.log('🧪 Debugging circuit input values...');
console.log('');

// Step 1: Check the raw email structure
console.log('📋 Step 1: Raw email analysis...');
const headerEnd = rawEmail.indexOf('\r\n\r\n');
const header = rawEmail.substring(0, headerEnd);
console.log(`   Header size: ${header.length} bytes`);
console.log(`   First 200 chars: "${header.substring(0, 200)}..."`);

// Find From header
const fromMatch = header.match(/^From: (.*)$/im);
if (fromMatch) {
    console.log(`   From header: "${fromMatch[0]}"`);
    console.log(`   From address: "${fromMatch[1]}"`);
} else {
    console.log('   ❌ From header not found');
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
                    console.log(`   Processed From: "${minimalFrom}" (${minimalFrom.length} chars)`);
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
console.log(`   Processed header size: ${processedHeader.length} bytes`);
console.log(`   Processed header: "${processedHeader}"`);
console.log('');

// Step 3: Find indices in processed header
console.log('📋 Step 3: Finding indices in processed header...');
const fromAddress = 'bracu-student@g.bracu.ac.bd';
const fromHeaderContent = processedHeader;

// Find From header
const processedFromMatch = fromHeaderContent.match(/^From: (.*)$/im);
if (processedFromMatch) {
    const headerIndex = processedFromMatch.index || 0;
    const headerLength = processedFromMatch[0].length;
    
    // Find email address within From header
    const addressMatch = processedFromMatch[1].match(/<([^>]+)>/);
    if (addressMatch) {
        const emailAddress = addressMatch[1];
        const addressIndexInHeader = processedFromMatch[1].indexOf(emailAddress);
        const addressIndex = headerIndex + processedFromMatch[0].indexOf(emailAddress);
        const addressLength = emailAddress.length;
        
        console.log(`   Header index: ${headerIndex}`);
        console.log(`   Header length: ${headerLength}`);
        console.log(`   Address index: ${addressIndex}`);
        console.log(`   Address length: ${addressLength}`);
        
        // Step 4: Check for bit size issues
        console.log('');
        console.log('📋 Step 4: Checking for bit size issues...');
        const values = [
            { name: 'headerIndex', value: headerIndex },
            { name: 'headerLength', value: headerLength },
            { name: 'addressIndex', value: addressIndex },
            { name: 'addressLength', value: addressLength }
        ];
        
        const maxU32 = 4294967295;
        values.forEach(({ name, value }) => {
            if (value < 0) {
                console.log(`   ❌ ${name} is negative: ${value}`);
            } else if (value > maxU32) {
                console.log(`   ❌ ${name} exceeds u32 max: ${value} > ${maxU32}`);
            } else {
                console.log(`   ✅ ${name} fits in u32: ${value}`);
            }
        });
        
        // Check minimum length requirement
        if (addressLength < 15) {
            console.log(`   ❌ Address length ${addressLength} is less than minimum 15 for BRACU domain`);
        } else {
            console.log(`   ✅ Address length ${addressLength} meets minimum requirement`);
        }
        
        // Check if address index is valid (must be > 0 for circuit)
        if (addressIndex <= 0) {
            console.log(`   ❌ Address index ${addressIndex} must be > 0 for circuit`);
        } else {
            console.log(`   ✅ Address index ${addressIndex} is valid for circuit`);
        }
    } else {
        console.log('   ❌ Email address not found in processed From header');
    }
} else {
    console.log('   ❌ From header not found in processed header');
}

console.log('');
console.log('🔍 Debug complete!');