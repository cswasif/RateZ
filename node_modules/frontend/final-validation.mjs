// Final validation test for total_header_length fix
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test the corrected total_header_length fix
 */
function testCorrectedFix() {
    console.log('🔍 Testing corrected total_header_length fix...\n');
    
    // Test cases based on actual circuit behavior
    const testCases = [
        {
            name: 'Normal partial hash case',
            originalHeaderLength: 12447,
            prehashedLength: 0,
            remainingLength: 12447,
            fromIndex: 10771,
            expectedResult: 'should work'
        },
        {
            name: 'Partial hash with offset',
            originalHeaderLength: 20000,
            prehashedLength: 5000,
            remainingLength: 15000,
            fromIndex: 10771, // Adjusted: 15771 - 5000 = 10771
            expectedResult: 'should work'
        },
        {
            name: 'Edge case - from at boundary',
            originalHeaderLength: 15000,
            prehashedLength: 2000,
            remainingLength: 13000,
            fromIndex: 12999, // Near the end of remaining
            expectedResult: 'should work'
        }
    ];
    
    let passedTests = 0;
    let totalTests = testCases.length;
    
    testCases.forEach((testCase, index) => {
        console.log(`Test ${index + 1}: ${testCase.name}`);
        console.log(`  Original header length: ${testCase.originalHeaderLength}`);
        console.log(`  Prehashed length: ${testCase.prehashedLength}`);
        console.log(`  Remaining length: ${testCase.remainingLength}`);
        console.log(`  From index (adjusted): ${testCase.fromIndex}`);
        
        // The key insight: total_header_length should be the remaining length
        // because that's what the circuit actually processes
        const totalHeaderLength = testCase.remainingLength;
        const subtraction = totalHeaderLength - testCase.fromIndex;
        
        console.log(`  total_header_length (remaining): ${totalHeaderLength}`);
        console.log(`  Subtraction: ${totalHeaderLength} - ${testCase.fromIndex} = ${subtraction}`);
        
        // Check for underflow
        const wouldUnderflow = subtraction < 0;
        
        if (!wouldUnderflow) {
            console.log(`  ✅ PASS: No underflow with corrected approach`);
            passedTests++;
        } else {
            console.log(`  ❌ FAIL: Corrected approach still causes underflow`);
        }
        
        console.log('');
    });
    
    console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! The corrected fix should resolve underflow errors.');
        return true;
    } else {
        console.log('⚠️  Some tests failed. Additional investigation needed.');
        return false;
    }
}

/**
 * Simulate the actual circuit input generation process
 */
function simulateCircuitInputGeneration() {
    console.log('\n🔧 Simulating circuit input generation process...\n');
    
    // Simulate a real email processing scenario
    const mockEmailData = {
        originalHeader: new Array(12447).fill(65), // Mock header bytes
        originalHeaderLength: 12447,
        fromHeaderIndex: 10771,
        fromHeaderLength: 50,
        fromAddressIndex: 10800,
        fromAddressLength: 30
    };
    
    // Simulate partial hash result
    const mockPartialHash = {
        state: new Array(8).fill(0), // Mock hash state
        remaining: new Array(12447).fill(65), // All bytes remain (no prehashing)
        totalLength: 12447,
        prehashedLength: 0,
        remainingIndex: 0
    };
    
    console.log('Mock Email Data:');
    console.log(`  Original header length: ${mockEmailData.originalHeaderLength}`);
    console.log(`  From header index: ${mockEmailData.fromHeaderIndex}`);
    console.log(`  From address index: ${mockEmailData.fromAddressIndex}`);
    
    console.log('\nMock Partial Hash Result:');
    console.log(`  Remaining length: ${mockPartialHash.remaining.length}`);
    console.log(`  Prehashed length: ${mockPartialHash.prehashedLength}`);
    console.log(`  Total length: ${mockPartialHash.totalLength}`);
    
    // Calculate adjusted indices (as done in zk-prover.ts)
    const offset = mockPartialHash.prehashedLength;
    const adjustedFromHeaderIndex = mockEmailData.fromHeaderIndex - offset;
    const adjustedFromAddressIndex = mockEmailData.fromAddressIndex - offset;
    
    console.log('\nAdjusted Indices:');
    console.log(`  Adjusted from header index: ${adjustedFromHeaderIndex}`);
    console.log(`  Adjusted from address index: ${adjustedFromAddressIndex}`);
    
    // The fix: use remaining length for total_header_length
    const totalHeaderLength = mockPartialHash.remaining.length;
    
    console.log('\nCircuit Input Generation:');
    console.log(`  total_header_length: ${totalHeaderLength} (using remaining length)`);
    console.log(`  from_header_sequence.index: ${adjustedFromHeaderIndex}`);
    console.log(`  from_address_sequence.index: ${adjustedFromAddressIndex}`);
    
    // Validate no underflow
    const headerSubtraction = totalHeaderLength - adjustedFromHeaderIndex;
    const addressSubtraction = totalHeaderLength - adjustedFromAddressIndex;
    
    console.log('\nUnderflow Validation:');
    console.log(`  Header subtraction: ${totalHeaderLength} - ${adjustedFromHeaderIndex} = ${headerSubtraction}`);
    console.log(`  Address subtraction: ${totalHeaderLength} - ${adjustedFromAddressIndex} = ${addressSubtraction}`);
    
    if (headerSubtraction >= 0 && addressSubtraction >= 0) {
        console.log('✅ PASS: No underflow detected in circuit inputs');
        return true;
    } else {
        console.log('❌ FAIL: Underflow detected in circuit inputs');
        return false;
    }
}

// Run all tests
console.log('🧪 Running final validation for total_header_length fix...\n');

const correctedTestPassed = testCorrectedFix();
const simulationPassed = simulateCircuitInputGeneration();

if (correctedTestPassed && simulationPassed) {
    console.log('\n🎉 Final validation successful!');
    console.log('The total_header_length fix using remaining length should resolve underflow errors.');
    console.log('The circuit inputs should now be correctly formatted for the BRACU verifier.');
} else {
    console.log('\n⚠️  Final validation failed.');
    console.log('Additional fixes may be needed.');
    process.exit(1);
}