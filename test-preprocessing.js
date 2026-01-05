// Test the new preprocessing approach with the real BRACU email
const fs = require('fs');
const path = require('path');

// Import the preprocessing functions
const { preprocessEmailHeaders, truncateHeaderForCircuit } = require('./packages/frontend/src/lib/email-preprocessor.ts');

async function testPreprocessing() {
    try {
        console.log('🧪 Testing email preprocessing with real BRACU email...');
        console.log('='.repeat(60));
        
        // Read the real BRACU email
        const emailPath = path.join(__dirname, 'Final Exam Schedule, Fall 2025.eml');
        const rawEmail = fs.readFileSync(emailPath, 'utf8');
        
        console.log(`📧 Loaded email: ${rawEmail.length} characters`);
        
        // Extract just the header portion
        const headerEnd = rawEmail.indexOf('\r\n\r\n');
        const headerText = headerEnd > 0 ? rawEmail.substring(0, headerEnd) : rawEmail;
        const headerBytes = new TextEncoder().encode(headerText);
        
        console.log(`📋 Original header: ${headerBytes.length} bytes`);
        
        // Test preprocessing
        console.log('\n🔧 Testing preprocessing...');
        const preprocessedBytes = preprocessEmailHeaders(headerBytes);
        
        // Test truncation if needed
        let finalBytes = preprocessedBytes;
        const CIRCUIT_MAX_REMAINING_HEADER = 512;
        
        if (preprocessedBytes.length > CIRCUIT_MAX_REMAINING_HEADER) {
            console.log('   ⚠️  Still too large, applying truncation...');
            finalBytes = truncateHeaderForCircuit(preprocessedBytes, CIRCUIT_MAX_REMAINING_HEADER);
        }
        
        console.log(`\n✅ Final result: ${finalBytes.length} bytes`);
        console.log(`   Size reduction: ${headerBytes.length - finalBytes.length} bytes (${Math.round((headerBytes.length - finalBytes.length) / headerBytes.length * 100)}%)`);
        
        // Show the final header content
        const finalHeader = new TextDecoder().decode(finalBytes);
        console.log('\n📄 Final processed header:');
        console.log(finalHeader);
        
        console.log('\n🎯 Summary:');
        console.log(`   Original: ${headerBytes.length} bytes`);
        console.log(`   Preprocessed: ${preprocessedBytes.length} bytes`);
        console.log(`   Final: ${finalBytes.length} bytes`);
        console.log(`   Target: ≤${CIRCUIT_MAX_REMAINING_HEADER} bytes`);
        console.log(`   ✅ Fits in circuit: ${finalBytes.length <= CIRCUIT_MAX_REMAINING_HEADER}`);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testPreprocessing();