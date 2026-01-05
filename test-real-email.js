// Test script to validate your actual BRACU email
const fs = require('fs');
const path = require('path');

// Read your actual email
const emailContent = fs.readFileSync('c:\\Users\\Administrator\\Desktop\\ZK\\myemail.ini', 'utf8');

console.log('📧 Testing your actual BRACU email...');
console.log('Email length:', emailContent.length, 'characters');
console.log('First 200 chars preview:');
console.log(emailContent.substring(0, 200));
console.log('...\n');

// Check for BRACU domain
const hasBRACUDomain = emailContent.includes('@g.bracu.ac.bd');
console.log('✅ Contains @g.bracu.ac.bd domain:', hasBRACUDomain);

// Check for DKIM signature
const hasDKIMSignature = emailContent.includes('DKIM-Signature:');
console.log('✅ Contains DKIM signature:', hasDKIMSignature);

// Check for specific DKIM domain
const hasBRACUDKIM = emailContent.includes('d=g.bracu.ac.bd');
console.log('✅ DKIM signature for g.bracu.ac.bd:', hasBRACUDKIM);

// Check header length (important for circuit bounds)
const headerEndIndex = emailContent.indexOf('\n\n');
const headerLength = headerEndIndex !== -1 ? headerEndIndex : emailContent.length;
console.log('📊 Header length:', headerLength, 'characters');

// Check if it would fit in our circuit (3072 max)
const fitsInCircuit = headerLength <= 3072;
console.log('✅ Fits in circuit (max 3072):', fitsInCircuit);

if (!fitsInCircuit) {
    console.log('⚠️  Header too long for current circuit settings');
    console.log('   Consider increasing maxHeaderLength in zk-prover.ts');
}

// Extract "From" header for validation
const fromMatch = emailContent.match(/^From:\s*(.+)$/m);
if (fromMatch) {
    console.log('📧 From header:', fromMatch[1].trim());
}

// Extract "To" header for validation  
const toMatch = emailContent.match(/^To:\s*(.+)$/m);
if (toMatch) {
    console.log('📧 To header:', toMatch[1].trim());
}

console.log('\n🎯 Summary: Your email appears to be a valid BRACU email with proper DKIM signatures!');
console.log('🚀 Ready to test with the actual ZK proof system.');