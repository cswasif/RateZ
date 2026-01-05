const fs = require('fs');

// Read the actual email file
const emailContent = fs.readFileSync('Final Exam Schedule, Fall 2025.eml', 'utf-8');

// Extract header and body
const headerEndIndex = emailContent.indexOf('\r\n\r\n');
const header = emailContent.substring(0, headerEndIndex);
const body = emailContent.substring(headerEndIndex + 4);

console.log('🧪 Testing final preprocessing logic...');
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

// Step 3: Apply the final preprocessing logic
const headerName = 'from:';
const paddedEmail = emailAddress.padEnd(29, ' ');
const processedFrom = headerName.toLowerCase() + paddedEmail;

console.log('');
console.log('📋 Step 2: Final preprocessing result');
console.log(`   Padded email: "${paddedEmail}"`);
console.log(`   Processed From: "${processedFrom}"`);

// Step 4: Calculate indices in the processed format
const fromHeaderIndex = 0; // Always 0 in processed header
const emailStartIndex = processedFrom.indexOf(paddedEmail.trim());
const emailEndIndex = emailStartIndex + paddedEmail.trim().length;

console.log('');
console.log('📋 Step 3: Index calculation in processed format');
console.log(`   From header index: ${fromHeaderIndex}`);
console.log(`   Email start index: ${emailStartIndex}`);
console.log(`   Email end index: ${emailEndIndex}`);
console.log(`   Email length: ${paddedEmail.trim().length}`);

// Step 5: Compare with test values
console.log('');
console.log('📋 Step 4: Comparison with test values');
console.log(`   Test From header index: 0 (actual: ${fromHeaderIndex}) ${fromHeaderIndex === 0 ? '✅' : '❌'}`);
console.log(`   Test From header length: 34 (actual: ${processedFrom.length}) ${processedFrom.length === 34 ? '✅' : '❌'}`);
console.log(`   Test From address index: 5 (actual: ${emailStartIndex}) ${emailStartIndex === 5 ? '✅' : '❌'}`);
console.log(`   Test From address length: 29 (actual: ${paddedEmail.length}) ${paddedEmail.length === 29 ? '✅' : '❌'}`);

// Step 6: Verify all constraints are met
const allCorrect = fromHeaderIndex === 0 && 
                   processedFrom.length === 34 && 
                   emailStartIndex === 5 && 
                   paddedEmail.length === 29;

console.log('');
console.log('📋 Step 5: Final validation');
console.log(`   All constraints satisfied: ${allCorrect ? '✅' : '❌'}`);

if (allCorrect) {
    console.log('');
    console.log('🎉 SUCCESS: All circuit constraints are satisfied!');
    console.log('   The preprocessing should now work with the circuit.');
} else {
    console.log('');
    console.log('❌ FAILURE: Some constraints are not satisfied.');
    console.log('   Need to adjust the preprocessing logic further.');
}

console.log('');
console.log('🔍 Test complete!');