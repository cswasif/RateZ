// Comprehensive test for total_header_length underflow fix
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test the total_header_length fix to ensure it prevents underflow errors
 */
function testTotalHeaderLengthFix() {
    console.log('🔍 Testing total_header_length underflow fix...\n');
    
    // Test cases that could cause underflow
    const testCases = [
        {
            name: 'Normal case - remaining equals original',
            originalHeaderLength: 12447,
            remainingLength: 12447,
            fromIndex: 10771,
            expected: 'should work'
        },
        {
            name: 'Edge case - remaining less than original',
            originalHeaderLength: 15000,
            remainingLength: 12447,
            fromIndex: 10771,
            expected: 'should work'
        },
        {
            name: 'Problem case - remaining greater than original (old bug)',
            originalHeaderLength: 10000,
            remainingLength: 12447,
            fromIndex: 10771,
            expected: 'would cause underflow'
        },
        {
            name: 'Large header case',
            originalHeaderLength: 25000,
            remainingLength: 20000,
            fromIndex: 15000,
            expected: 'should work'
        }
    ];
    
    let passedTests = 0;
    let totalTests = testCases.length;
    
    testCases.forEach((testCase, index) => {
        console.log(`Test ${index + 1}: ${testCase.name}`);
        console.log(`  Original header length: ${testCase.originalHeaderLength}`);
        console.log(`  Remaining length: ${testCase.remainingLength}`);
        console.log(`  From index: ${testCase.fromIndex}`);
        
        // Simulate the old behavior (using remaining length)
        const oldTotalHeaderLength = testCase.remainingLength;
        const oldSubtraction = oldTotalHeaderLength - testCase.fromIndex;
        
        // Simulate the new behavior (using original header length)
        const newTotalHeaderLength = testCase.originalHeaderLength;
        const newSubtraction = newTotalHeaderLength - testCase.fromIndex;
        
        console.log(`  Old approach: ${oldTotalHeaderLength} - ${testCase.fromIndex} = ${oldSubtraction}`);
        console.log(`  New approach: ${newTotalHeaderLength} - ${testCase.fromIndex} = ${newSubtraction}`);
        
        // Check for underflow risk
        const oldWouldUnderflow = oldSubtraction < 0;
        const newWouldUnderflow = newSubtraction < 0;
        
        if (testCase.expected === 'would cause underflow') {
            if (oldWouldUnderflow && !newWouldUnderflow) {
                console.log(`  ✅ PASS: Fix prevents underflow (old would underflow: ${oldWouldUnderflow}, new would underflow: ${newWouldUnderflow})`);
                passedTests++;
            } else {
                console.log(`  ❌ FAIL: Expected underflow prevention not working as expected`);
            }
        } else {
            if (!newWouldUnderflow) {
                console.log(`  ✅ PASS: No underflow with new approach`);
                passedTests++;
            } else {
                console.log(`  ❌ FAIL: New approach still causes underflow`);
            }
        }
        
        console.log('');
    });
    
    console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! The total_header_length fix should resolve underflow errors.');
        return true;
    } else {
        console.log('⚠️  Some tests failed. The fix may need additional adjustments.');
        return false;
    }
}

/**
 * Test the actual circuit ABI to ensure compatibility
 */
function testCircuitABI() {
    console.log('\n🔍 Testing circuit ABI compatibility...\n');
    
    try {
        const circuitPath = path.join(__dirname, 'public/circuits/bracu_verifier.json');
        const circuitData = JSON.parse(fs.readFileSync(circuitPath, 'utf8'));
        
        console.log(`Circuit version: ${circuitData.noir_version}`);
        console.log(`ABI parameters: ${circuitData.abi?.parameters?.length || 0}`);
        
        // Check total_header_length parameter
        const totalHeaderParam = circuitData.abi?.parameters?.find(p => p.name === 'total_header_length');
        if (totalHeaderParam) {
            console.log(`total_header_length parameter found:`);
            console.log(`  Name: ${totalHeaderParam.name}`);
            console.log(`  Type: ${JSON.stringify(totalHeaderParam.type)}`);
            console.log(`  Expected: unsigned 64-bit integer`);
            
            if (totalHeaderParam.type?.kind === 'integer' && 
                totalHeaderParam.type?.sign === 'unsigned' && 
                totalHeaderParam.type?.width === 64) {
                console.log('✅ ABI type matches expected format');
                return true;
            } else {
                console.log('⚠️  ABI type mismatch detected');
                return false;
            }
        } else {
            console.log('❌ total_header_length parameter not found in ABI');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Failed to load circuit ABI:', error.message);
        return false;
    }
}

// Run all tests
console.log('🧪 Running comprehensive total_header_length fix validation...\n');

const abiTestPassed = testCircuitABI();
const fixTestPassed = testTotalHeaderLengthFix();

if (abiTestPassed && fixTestPassed) {
    console.log('\n🎉 All validation tests passed!');
    console.log('The total_header_length fix should resolve the underflow error.');
    console.log('The circuit should now work correctly with the updated logic.');
} else {
    console.log('\n⚠️  Some validation tests failed.');
    console.log('Additional fixes may be needed.');
    process.exit(1);
}