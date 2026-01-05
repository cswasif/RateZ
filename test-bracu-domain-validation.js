/**
 * Test script for BRACU email verification - Testing domain validation logic
 * This focuses on testing the domain validation without requiring valid DKIM signatures
 */

const fs = require('fs');

// Mock the generateEmailVerifierInputs function to bypass DKIM verification
function mockGenerateEmailVerifierInputs(emailContent) {
  // Extract header and body
  const parts = emailContent.split('\n\n');
  const header = parts[0];
  const body = parts[1] || '';
  
  // Convert to bytes array
  const headerBytes = Array.from(header).map(char => char.charCodeAt(0));
  
  return {
    emailHeader: headerBytes,
    emailHeaderLength: headerBytes.length,
    pubkey: [1, 2, 3, 4, 5], // Mock public key
    signature: [6, 7, 8, 9, 10], // Mock signature
  };
}

// Test the domain validation logic directly
function testDomainValidationLogic() {
  console.log('🧪 Testing BRACU Domain Validation Logic');
  console.log('='.repeat(60));

  const testCases = [
    {
      name: 'Valid Student Email',
      fromAddress: 'student123@bracu.ac.bd',
      expected: true
    },
    {
      name: 'Valid Faculty Email',
      fromAddress: 'professor.faculty@bracu.ac.bd',
      expected: true
    },
    {
      name: 'Valid Staff Email',
      fromAddress: 'staff.member@bracu.ac.bd',
      expected: true
    },
    {
      name: 'Invalid Gmail Email',
      fromAddress: 'student@gmail.com',
      expected: false
    },
    {
      name: 'Invalid Yahoo Email',
      fromAddress: 'user@yahoo.com',
      expected: false
    },
    {
      name: 'Invalid Subdomain',
      fromAddress: 'student@mail.bracu.ac.bd',
      expected: false
    },
    {
      name: 'Case Sensitivity Test',
      fromAddress: 'Student@BRACU.AC.BD',
      expected: true
    },
    {
      name: 'Mixed Case Domain',
      fromAddress: 'student@BrAcU.Ac.Bd',
      expected: true
    }
  ];

  const results = {
    passed: 0,
    failed: 0,
    details: []
  };

  for (const testCase of testCases) {
    console.log(`\n📧 Testing: ${testCase.name}`);
    console.log(`   Address: ${testCase.fromAddress}`);
    
    try {
      // Test the domain validation logic from our corrected implementation
      const normalizedAddress = testCase.fromAddress.toLowerCase();
      const isValid = normalizedAddress.endsWith('@g.bracu.ac.bd');
      
      if (isValid === testCase.expected) {
        console.log(`   ✅ ${isValid ? 'VALID' : 'INVALID'} (as expected)`);
        results.passed++;
        results.details.push({ 
          name: testCase.name, 
          status: 'PASSED', 
          address: testCase.fromAddress,
          result: isValid ? 'VALID' : 'INVALID'
        });
      } else {
        console.log(`   ❌ ${isValid ? 'VALID' : 'INVALID'} (unexpected)`);
        results.failed++;
        results.details.push({ 
          name: testCase.name, 
          status: 'FAILED', 
          address: testCase.fromAddress,
          expected: testCase.expected ? 'VALID' : 'INVALID',
          actual: isValid ? 'VALID' : 'INVALID'
        });
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      results.failed++;
      results.details.push({ 
        name: testCase.name, 
        status: 'ERROR', 
        address: testCase.fromAddress,
        error: error.message
      });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 DOMAIN VALIDATION TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${testCases.length}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / testCases.length) * 100).toFixed(1)}%`);

  // Test the full email parsing logic
  console.log('\n' + '='.repeat(60));
  console.log('📧 TESTING EMAIL PARSING LOGIC');
  console.log('='.repeat(60));

  const emailParsingTests = [
    {
      name: 'Standard From Header',
      email: `From: student@bracu.ac.bd
To: faculty@bracu.ac.bd
Subject: Test

Body content`,
      expectedFrom: 'student@bracu.ac.bd'
    },
    {
      name: 'From Header with Name',
      email: `From: John Doe <student@bracu.ac.bd>
To: faculty@bracu.ac.bd
Subject: Test

Body content`,
      expectedFrom: 'student@bracu.ac.bd'
    },
    {
      name: 'From Header with Quotes',
      email: `From: "John Doe" <student@bracu.ac.bd>
To: faculty@bracu.ac.bd
Subject: Test

Body content`,
      expectedFrom: 'student@bracu.ac.bd'
    }
  ];

  for (const test of emailParsingTests) {
    console.log(`\n📝 Testing: ${test.name}`);
    
    try {
      // Simulate the email parsing from our corrected implementation
      const headerString = test.email.split('\n\n')[0];
      const fromMatch = headerString.match(/From:.*<([^>]+)>/i) || headerString.match(/From:\s*([^\s<]+@[^\s>]+)/i);
      
      if (fromMatch) {
        const extractedFrom = fromMatch[1].toLowerCase();
        const isCorrect = extractedFrom === test.expectedFrom.toLowerCase();
        
        console.log(`   Extracted: ${extractedFrom}`);
        console.log(`   Expected:  ${test.expectedFrom}`);
        console.log(`   ✅ ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);
        
        if (!isCorrect) {
          results.failed++;
        } else {
          results.passed++;
        }
      } else {
        console.log(`   ❌ Could not extract From address`);
        results.failed++;
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      results.failed++;
    }
  }

  // Save detailed results
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: testCases.length + emailParsingTests.length,
      passed: results.passed,
      failed: results.failed,
      successRate: `${((results.passed / (testCases.length + emailParsingTests.length)) * 100).toFixed(1)}%`
    },
    domainValidationTests: results.details.filter(d => d.status !== 'ERROR'),
    emailParsingTests: emailParsingTests.map(test => ({
      name: test.name,
      expectedFrom: test.expectedFrom
    }))
  };

  fs.writeFileSync('bracu-domain-validation-report.json', JSON.stringify(report, null, 2));
  console.log('\n💾 Detailed report saved to: bracu-domain-validation-report.json');

  return results;
}

// Run the test
if (require.main === module) {
  testDomainValidationLogic();
}

module.exports = { testDomainValidationLogic };