/**
 * CORRECTED VERSION: Generate ZK circuit inputs for BRACU email verification
 * This fixes all the bugs identified in the original implementation
 */

import { generateEmailVerifierInputs } from '@zk-email/helpers/dist/input-generators';

/**
 * Generate ZK circuit inputs for BRACU email verification using the official zk-email library
 * FIXED: Removed invalid parameters and functions that don't exist
 */
export async function generateBRACUCircuitInputs(emailContent: string | Buffer) {
  try {
    // FIXED: Use correct parameters - removed invalid 'extractFrom'
    const circuitInputs = await generateEmailVerifierInputs(emailContent, {
      maxHeadersLength: 1408,
      maxBodyLength: 1280,
      ignoreBodyHashCheck: false,
    });

    console.log('✅ Generated circuit inputs using zk-email library');
    console.log(`   Header length: ${circuitInputs.emailHeaderLength}`);
    console.log(`   Header bytes: ${circuitInputs.emailHeader.length}`);
    console.log(`   Signature length: ${circuitInputs.signature.length}`);

    // FIXED: Manually extract From address since 'extractFrom' parameter doesn't exist
    const headerString = circuitInputs.emailHeader.map(b => String.fromCharCode(parseInt(b))).join('');
    const fromMatch = headerString.match(/From:.*<([^>]+)>/i) || headerString.match(/From:\s*([^\s<]+@[^\s>]+)/i);
    
    if (!fromMatch) {
      throw new Error('Could not find From address in email');
    }

    const fromAddress = fromMatch[1].toLowerCase();
    console.log(`   Extracted From address: ${fromAddress}`);

    // FIXED: Validate BRACU domain
    if (!fromAddress.endsWith('@g.bracu.ac.bd')) {
      throw new Error(`Invalid email domain. Must be @g.bracu.ac.bd, got: ${fromAddress}`);
    }

    // FIXED: Find From header indices manually
    const fromHeaderIndex = headerString.toLowerCase().indexOf('from:');
    const fromAddressIndex = headerString.toLowerCase().indexOf(fromAddress.toLowerCase());

    // FIXED: Calculate proper header length (find end of From header)
    const fromHeaderStart = headerString.substring(fromHeaderIndex);
    const fromHeaderEndMatch = fromHeaderStart.match(/\r?\n(?!\s)/);
    const fromHeaderLength = fromHeaderEndMatch && fromHeaderEndMatch.index !== undefined ? fromHeaderEndMatch.index : fromHeaderStart.length;

    return {
      // FIXED: Use correct property names from actual library
      emailHeader: circuitInputs.emailHeader.map(s => parseInt(s)),
      emailHeaderLength: parseInt(circuitInputs.emailHeaderLength),
      pubkey: circuitInputs.pubkey,
      signature: circuitInputs.signature,
      fromHeaderIndex: Math.max(0, fromHeaderIndex),
      fromHeaderLength: Math.max(1, fromHeaderLength),
      fromAddressIndex: Math.max(0, fromAddressIndex),
      fromAddressLength: fromAddress.length,
      fromEmailDomain: 'g.bracu.ac.bd',
      fromEmailAddress: fromAddress, // FIXED: Actually populate this field
    };

  } catch (error) {
    console.error('❌ Failed to generate circuit inputs:', error);
    throw error;
  }
}

/**
 * REMOVED: generateBRACUCircuitInputsAdvanced function
 * REASON: Used non-existent function 'generateEmailVerifierInputsFromDKIMResult'
 * This function never existed in the zk-email library
 */

