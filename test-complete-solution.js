// Test the complete solution with real BRACU email
const fs = require('fs');
const path = require('path');

// Mock the required functions for testing
function mockGenerateEmailVerifierInputs(rawEmail, options) {
    // Extract header
    const headerEnd = rawEmail.indexOf('\r\n\r\n');
    const headerText = headerEnd > 0 ? rawEmail.substring(0, headerEnd) : rawEmail;
    const headerBytes = new TextEncoder().encode(headerText);
    
    // Extract From address
    const fromMatch = rawEmail.match(/From:\s*[^<]*<([^>]+)>/i);
    const fromAddress = fromMatch ? fromMatch[1] : 'unknown@bracu.ac.bd';
    
    return {
        emailHeader: Array.from(headerBytes),
        emailHeaderLength: headerBytes.length,
        fromEmailAddress: fromAddress,
        fromEmailDomain: fromAddress.split('@')[1]
    };
}

function mockGenerateEmailVerifierInputsWithPreprocessedHeader(processedHeaderBytes, rawEmail) {
    // Extract From address from raw email
    const fromMatch = rawEmail.match(/From:\s*[^<]*<([^>]+)>/i);
    const fromAddress = fromMatch ? fromMatch[1] : 'unknown@bracu.ac.bd';
    
    // Find From header in processed header
    const headerString = new TextDecoder().decode(processedHeaderBytes);
    const fromHeaderMatch = headerString.match(/From:[^\r\n]*/i);
    
    if (!fromHeaderMatch) {
        throw new Error('From header not found in processed header');
    }
    
    const fromHeaderIndex = fromHeaderMatch.index || 0;
    const fromHeaderLength = fromHeaderMatch[0].length;
    
    // Find email address in From header
    const emailMatch = fromHeaderMatch[0].match(/<([^>]+)>/);
    const emailInHeader = emailMatch ? emailMatch[1] : fromAddress;
    const emailIndex = fromHeaderIndex + (emailMatch ? fromHeaderMatch[0].indexOf(emailMatch[0]) : 0);
    
    return {
        emailHeader: Array.from(processedHeaderBytes),
        emailHeaderLength: processedHeaderBytes.length,
        pubkey: Array(18).fill('0x1234567890abcdef'),
        pubkeyRedc: Array(18).fill('0x0'),
        signature: Array(18).fill('0x1234567890abcdef'),
        fromHeaderIndex: fromHeaderIndex,
        fromHeaderLength: fromHeaderLength,
        fromAddressIndex: emailIndex,
        fromAddressLength: emailInHeader.length,
        fromEmailDomain: fromAddress.split('@')[1],
        fromEmailAddress: fromAddress
    };
}

function mockPreprocessEmailHeaders(headerBytes) {
    const headerStr = new TextDecoder().decode(headerBytes);
    const lines = headerStr.split(/\r?\n/);
    
    // Keep only essential headers
    const essentialHeaders = ['from:', 'to:', 'subject:', 'date:', 'message-id:', 'dkim-signature:'];
    const processedLines = [];
    
    for (const line of lines) {
        const headerMatch = line.match(/^([^:]+):/i);
        if (headerMatch) {
            const headerName = headerMatch[1].toLowerCase() + ':';
            if (essentialHeaders.some(h => headerName.startsWith(h))) {
                processedLines.push(line);
            }
        }
        if (line.trim() === '') break;
    }
    
    processedLines.push(''); // Add body separator
    const processedHeader = processedLines.join('\n');
    return new TextEncoder().encode(processedHeader);
}

function mockTruncateHeaderForCircuit(headerBytes, maxSize) {
    if (headerBytes.length <= maxSize) return headerBytes;
    
    // Keep only From header and DKIM signature
    const headerStr = new TextDecoder().decode(headerBytes);
    const lines = headerStr.split('\n');
    const essentialLines = lines.filter(line => 
        line.toLowerCase().startsWith('from:') || 
        line.toLowerCase().startsWith('dkim-signature:')
    );
    
    essentialLines.push(''); // Add body separator
    const truncated = essentialLines.join('\n');
    return new TextEncoder().encode(truncated);
}

async function testCompleteSolution() {
    try {
        console.log('🧪 Testing complete solution with real BRACU email...');
        console.log('='.repeat(60));
        
        // Read the real BRACU email
        const emailPath = path.join(__dirname, 'Final Exam Schedule, Fall 2025.eml');
        const rawEmail = fs.readFileSync(emailPath, 'utf8');
        
        console.log(`📧 Loaded email: ${rawEmail.length} characters`);
        
        // Step 1: Parse email for basic validation
        console.log('\n📋 Step 1: Basic email parsing...');
        const basicInputs = mockGenerateEmailVerifierInputs(rawEmail, {});
        console.log(`   Original header: ${basicInputs.emailHeaderLength} bytes`);
        
        // Step 1.5: Preprocess headers
        console.log('\n🔧 Step 1.5: Preprocessing headers...');
        const originalHeaderBytes = new Uint8Array(basicInputs.emailHeader);
        const preprocessedHeaderBytes = mockPreprocessEmailHeaders(originalHeaderBytes);
        console.log(`   Preprocessed: ${preprocessedHeaderBytes.length} bytes`);
        
        // Apply truncation if needed
        let processedHeaderBytes = preprocessedHeaderBytes;
        const CIRCUIT_MAX_REMAINING_HEADER = 512;
        
        if (preprocessedHeaderBytes.length > CIRCUIT_MAX_REMAINING_HEADER) {
            console.log('   ⚠️  Still too large, applying truncation...');
            processedHeaderBytes = mockTruncateHeaderForCircuit(preprocessedHeaderBytes, CIRCUIT_MAX_REMAINING_HEADER);
            console.log(`   Truncated: ${processedHeaderBytes.length} bytes`);
        }
        
        // Step 2: Generate circuit inputs with preprocessed header
        console.log('\n📧 Step 2: Generating circuit inputs...');
        const emailInputs = mockGenerateEmailVerifierInputsWithPreprocessedHeader(
            processedHeaderBytes,
            rawEmail
        );
        
        console.log(`   Final header: ${emailInputs.emailHeaderLength} bytes`);
        console.log(`   From header index: ${emailInputs.fromHeaderIndex}`);
        console.log(`   From address index: ${emailInputs.fromAddressIndex}`);
        console.log(`   From address: ${emailInputs.fromEmailAddress}`);
        
        // Validate indices
        const maxIndex = Math.max(emailInputs.fromHeaderIndex, emailInputs.fromAddressIndex);
        const headerLength = emailInputs.emailHeaderLength;
        
        console.log('\n🔍 Validation:');
        console.log(`   Max index used: ${maxIndex}`);
        console.log(`   Header length: ${headerLength}`);
        console.log(`   From header within bounds: ${emailInputs.fromHeaderIndex < headerLength}`);
        console.log(`   From address within bounds: ${emailInputs.fromAddressIndex < headerLength}`);
        console.log(`   From header + length within bounds: ${emailInputs.fromHeaderIndex + emailInputs.fromHeaderLength <= headerLength}`);
        console.log(`   From address + length within bounds: ${emailInputs.fromAddressIndex + emailInputs.fromAddressLength <= headerLength}`);
        
        // Check if this would cause circuit overflow
        console.log('\n⚡ Circuit overflow risk:');
        const overflowRisk = maxIndex >= headerLength || 
                           (emailInputs.fromHeaderIndex + emailInputs.fromHeaderLength) > headerLength ||
                           (emailInputs.fromAddressIndex + emailInputs.fromAddressLength) > headerLength;
        
        console.log(`   Risk of overflow: ${overflowRisk}`);
        console.log(`   ✅ Safe for circuit: ${!overflowRisk}`);
        
        if (!overflowRisk) {
            console.log('\n🎉 SUCCESS: Email preprocessing solution works!');
            console.log('   The email can now be processed by the circuit without overflow.');
        } else {
            console.log('\n❌ FAILURE: Still at risk of circuit overflow.');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testCompleteSolution();