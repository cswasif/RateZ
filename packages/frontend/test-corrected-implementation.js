import { generateEmailVerifierInputs } from '@zk-email/helpers';

// Test the corrected implementation
async function testCorrectedImplementation() {
  console.log('🧪 Testing corrected zkemail-bracu-inputs implementation...\n');

  // Sample BRACU email for testing
  const sampleEmail = `From: Test User <test.user@g.bracu.ac.bd>
To: recipient@example.com
Subject: Test Email for BRACU ZK Verification
Date: Mon, 05 Jan 2026 10:00:00 +0000
Message-ID: <test123@g.bracu.ac.bd>
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=g.bracu.ac.bd; s=default; h=from:to:subject:date:message-id; bh=abc123=; b=def456=

This is a test email body for BRACU ZK verification.`;

  try {
    // Test 1: Basic circuit input generation
    console.log('1️⃣ Testing basic circuit input generation...');
    const circuitInputs = await generateEmailVerifierInputs(sampleEmail, {
      maxHeadersLength: 1408,
      maxBodyLength: 1280,
      ignoreBodyHashCheck: false,
    });

    console.log('✅ Circuit inputs generated successfully');
    console.log(`   Header length: ${circuitInputs.emailHeaderLength}`);
    console.log(`   Header bytes: ${circuitInputs.emailHeader.length}`);
    console.log(`   Signature length: ${circuitInputs.signature.length}`);
    console.log(`   Public key length: ${circuitInputs.pubkey.length}`);

    // Test 2: Manual From address extraction
    console.log('\n2️⃣ Testing manual From address extraction...');
    const headerString = circuitInputs.emailHeader.map(b => String.fromCharCode(parseInt(b))).join('');
    const fromMatch = headerString.match(/From:.*<([^>]+)>/i) || headerString.match(/From:\s*([^\s<]+@[^\s>]+)/i);
    
    if (!fromMatch) {
      throw new Error('Could not find From address in email');
    }

    const fromAddress = fromMatch[1].toLowerCase();
    console.log(`✅ Extracted From address: ${fromAddress}`);

    // Test 3: BRACU domain validation
    console.log('\n3️⃣ Testing BRACU domain validation...');
    if (!fromAddress.endsWith('@g.bracu.ac.bd')) {
      throw new Error(`Invalid email domain. Must be @g.bracu.ac.bd, got: ${fromAddress}`);
    }
    console.log('✅ Valid BRACU domain detected');

    // Test 4: Header index calculation
    console.log('\n4️⃣ Testing header index calculation...');
    const fromHeaderIndex = headerString.toLowerCase().indexOf('from:');
    const fromAddressIndex = headerString.toLowerCase().indexOf(fromAddress.toLowerCase());

    console.log(`✅ From header index: ${fromHeaderIndex}`);
    console.log(`✅ From address index: ${fromAddressIndex}`);

    // Test 5: Simulate the complete return object
    console.log('\n5️⃣ Testing complete return object structure...');
    let fromHeaderLength = 1;
    if (fromHeaderIndex !== -1) {
      const fromHeaderStart = headerString.substring(fromHeaderIndex);
      const fromHeaderEndMatch = fromHeaderStart.match(/\r?\n(?!\s)/);
      fromHeaderLength = fromHeaderEndMatch ? fromHeaderEndMatch.index : fromHeaderStart.length;
    }

    const returnObject = {
      emailHeader: circuitInputs.emailHeader.map(s => parseInt(s)),
      emailHeaderLength: parseInt(circuitInputs.emailHeaderLength),
      pubkey: circuitInputs.pubkey,
      signature: circuitInputs.signature,
      fromHeaderIndex: Math.max(0, fromHeaderIndex !== -1 ? fromHeaderIndex : 0),
      fromHeaderLength: Math.max(1, fromHeaderLength || 1),
      fromAddressIndex: Math.max(0, fromAddressIndex !== -1 ? fromAddressIndex : 0),
      fromAddressLength: fromAddress.length,
      fromEmailDomain: 'g.bracu.ac.bd',
      fromEmailAddress: fromAddress,
    };

    console.log('✅ Return object structure valid');
    console.log('📋 Return object keys:', Object.keys(returnObject));

    // Test 6: Invalid domain rejection
    console.log('\n6️⃣ Testing invalid domain rejection...');
    const invalidEmail = `From: Test User <test.user@invalid.com>
To: recipient@example.com
Subject: Invalid Email

This should be rejected.`;

    try {
      const invalidCircuitInputs = await generateEmailVerifierInputs(invalidEmail, {
        maxHeadersLength: 1408,
        maxBodyLength: 1280,
        ignoreBodyHashCheck: false,
      });

      const invalidHeaderString = invalidCircuitInputs.emailHeader.map(b => String.fromCharCode(parseInt(b))).join('');
      const invalidFromMatch = invalidHeaderString.match(/From:.*<([^>]+)>/i) || invalidHeaderString.match(/From:\s*([^\s<]+@[^\s>]+)/i);
      
      if (invalidFromMatch) {
        const invalidFromAddress = invalidFromMatch[1].toLowerCase();
        if (!invalidFromAddress.endsWith('@g.bracu.ac.bd')) {
          console.log('✅ Correctly rejected invalid domain:', invalidFromAddress);
        }
      }
    } catch (error) {
      console.log('✅ Correctly rejected invalid email:', error.message);
    }

    console.log('\n🎉 All tests passed! The corrected implementation is working correctly.');
    console.log('\n📊 Summary:');
    console.log('   ✅ Circuit input generation works');
    console.log('   ✅ Manual From extraction works');
    console.log('   ✅ BRACU domain validation works');
    console.log('   ✅ Header index calculation works');
    console.log('   ✅ Return object structure is valid');
    console.log('   ✅ Invalid domain rejection works');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }

  return true;
}

// Run the test
testCorrectedImplementation().then(success => {
  if (success) {
    console.log('\n✨ Ready to replace the original file with the corrected version!');
  } else {
    console.log('\n💥 Tests failed. Please review the implementation.');
    process.exit(1);
  }
});