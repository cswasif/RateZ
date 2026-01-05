/**
 * Test script for BRACU email verification with real email samples
 * This tests the corrected zkemail-bracu-inputs.ts with realistic BRACU email formats
 */

const { generateBRACUCircuitInputs } = require('./packages/frontend/src/lib/zkemail-bracu-inputs.ts');
const fs = require('fs');

// Sample BRACU email with DKIM signature (simplified for testing)
const sampleBRACUEmail = `From: student@example.com
To: faculty@bracu.ac.bd
Subject: Assignment Submission
Date: Mon, 05 Jan 2026 10:00:00 +0000
Message-ID: <123456789@example.com>
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=bracu.ac.bd; s=default; h=from:to:subject:date:message-id; bh=abc123def456; b=xyz789uvw456

Dear Professor,

Please find attached my assignment submission.

Best regards,
Student`;

// Test function for BRACU email validation
async function testBRACUEmailVerification() {
  console.log('🧪 Testing BRACU Email Verification with Corrected Implementation');
  console.log('=' .repeat(60));

  const testCases = [
    {
      name: 'Valid BRACU Email',
      email: `From: student123@bracu.ac.bd
To: faculty@bracu.ac.bd
Subject: Test Email
Date: Mon, 05 Jan 2026 10:00:00 +0000
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=bracu.ac.bd; s=default; h=from:to:subject:date; bh=abc123def456; b=xyz789uvw456

This is a test email from a BRACU student.`,
      expected: true
    },
    {
      name: 'Invalid Domain Email',
      email: `From: student@gmail.com
To: faculty@bracu.ac.bd
Subject: Test Email
Date: Mon, 05 Jan 2026 10:00:00 +0000
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=gmail.com; s=default; h=from:to:subject:date; bh=abc123def456; b=xyz789uvw456

This is a test email from external domain.`,
      expected: false
    },
    {
      name: 'BRACU Faculty Email',
      email: `From: professor.faculty@bracu.ac.bd
To: student@bracu.ac.bd
Subject: Class Update
Date: Mon, 05 Jan 2026 10:00:00 +0000
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=bracu.ac.bd; s=default; h=from:to:subject:date; bh=abc123def456; b=xyz789uvw456

Dear students, please check the updated schedule.`,
      expected: true
    },
    {
      name: 'BRACU Staff Email',
      email: `From: staff.member@bracu.ac.bd
To: all@bracu.ac.bd
Subject: Important Notice
Date: Mon, 05 Jan 2026 10:00:00 +0000
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=bracu.ac.bd; s=default; h=from:to:subject:date; bh=abc123def456; b=xyz789uvw456

This is an important announcement for all staff.`,
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
    console.log('-'.repeat(40));
    
    try {
      const result = await generateBRACUCircuitInputs(testCase.email);
      
      if (testCase.expected) {
        console.log('✅ SUCCESS: Email processed successfully');
        console.log(`   From Address: ${result.fromEmailAddress}`);
        console.log(`   Domain: ${result.fromEmailDomain}`);
        console.log(`   Header Index: ${result.fromHeaderIndex}`);
        console.log(`   Address Index: ${result.fromAddressIndex}`);
        console.log(`   Signature Length: ${result.signature.length}`);
        results.passed++;
        results.details.push({ name: testCase.name, status: 'PASSED', fromAddress: result.fromEmailAddress });
      } else {
        console.log('❌ UNEXPECTED: Expected this to fail but it succeeded');
        results.failed++;
        results.details.push({ name: testCase.name, status: 'UNEXPECTED_SUCCESS', fromAddress: result.fromEmailAddress });
      }
    } catch (error) {
      if (!testCase.expected) {
        console.log('✅ SUCCESS: Correctly rejected invalid email');
        console.log(`   Error: ${error.message}`);
        results.passed++;
        results.details.push({ name: testCase.name, status: 'PASSED', error: error.message });
      } else {
        console.log('❌ FAILED: Unexpected error with valid email');
        console.log(`   Error: ${error.message}`);
        results.failed++;
        results.details.push({ name: testCase.name, status: 'FAILED', error: error.message });
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${testCases.length}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / testCases.length) * 100).toFixed(1)}%`);

  // Save detailed results
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: testCases.length,
      passed: results.passed,
      failed: results.failed,
      successRate: `${((results.passed / testCases.length) * 100).toFixed(1)}%`
    },
    details: results.details
  };

  fs.writeFileSync('bracu-email-test-report.json', JSON.stringify(report, null, 2));
  console.log('\n💾 Detailed report saved to: bracu-email-test-report.json');

  return results;
}

// Run the test
if (require.main === module) {
  testBRACUEmailVerification().catch(console.error);
}

module.exports = { testBRACUEmailVerification };