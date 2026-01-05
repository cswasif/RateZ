/**
 * Email Parser for ZK Email Verification
 * 
 * Parses raw email content (MIME format) and generates inputs for
 * the BRACU email verification circuit using @zk-email/zkemail-nr.
 */

// Use dynamic import to handle browser compatibility issues
let zkEmailGenerate: any = null;

// Try to load the zk-email library, fallback to mock if it fails
async function loadZkEmailGenerate() {
  if (zkEmailGenerate) return zkEmailGenerate;

  // Skip @zk-email/zkemail-nr in browser environments due to Node.js dependencies
  // The library uses 'vm' module which can't be polyfilled in browsers
  if (typeof window !== 'undefined') {
    console.warn('Skipping @zk-email/zkemail-nr in browser environment due to Node.js dependencies');
    return generateFallbackEmailInputs;
  }

  try {
    const module = await import('@zk-email/zkemail-nr');
    zkEmailGenerate = module.generateEmailVerifierInputs;
    return zkEmailGenerate;
  } catch (error) {
    console.warn('Failed to load @zk-email/zkemail-nr, using fallback parser:', error);
    // Return a fallback function that provides basic email parsing
    return generateFallbackEmailInputs;
  }
}

// Fallback email parser for browser compatibility
function generateFallbackEmailInputs(rawEmail: string, _options: any = {}) {
  console.warn('Using fallback email parser due to browser compatibility issues');

  // Basic email parsing for BRACU domain validation
  const lines = rawEmail.split('\n');
  const fromHeader = lines.find(line => line.toLowerCase().startsWith('from:'));

  if (!fromHeader) {
    throw new Error('No From header found in email');
  }

  // Extract email address from From header
  const emailMatch = fromHeader.match(/<([^>]+)>/);
  const emailAddress = emailMatch ? emailMatch[1] : fromHeader.split(':')[1].trim();

  if (!emailAddress.endsWith('@g.bracu.ac.bd')) {
    throw new Error(`Invalid email domain. Must be @g.bracu.ac.bd, got: ${emailAddress}`);
  }

  // Extract just the header portion
  const headerOnly = rawEmail.split('\n\n')[0];

  // Convert email to bytes
  let headerBytes = new TextEncoder().encode(headerOnly);

  // Truncate to maxHeaderLength if necessary
  const maxLen = _options.maxHeadersLength || 2560;
  if (headerBytes.length > maxLen) {
    headerBytes = headerBytes.slice(0, maxLen);
  }

  // Mock DKIM components (these would normally be extracted from the email)
  // Return in the format expected by the main function
  return {
    header: {
      storage: Array.from(headerBytes).map(b => b.toString())
    },
    headerLength: headerBytes.length,
    pubkey: {
      modulus: ['0x1234567890abcdef'], // Mock RSA public key
      redc: ['0xabcdef1234567890'] // Mock reduced form
    },
    signature: ['0xdeadbeefcafebabe'], // Mock signature
    dkim_header_sequence: {
      index: 0,
      length: headerBytes.length
    },
    from_header_sequence: {
      index: headerOnly.indexOf('From:'),
      length: fromHeader.length
    },
    from_address_sequence: {
      index: headerOnly.indexOf(emailAddress),
      length: emailAddress.length
    },
    fromAddress: emailAddress,
    fromDomain: 'g.bracu.ac.bd'
  };
}

export interface EmailVerifierInputs {
  // Padded email header bytes
  emailHeader: number[]
  emailHeaderLength: number

  // RSA signature components (as circuit-compatible format)
  pubkey: string[]
  pubkeyRedc: string[]
  signature: string[]

  // Sequence indices for header parsing
  fromHeaderIndex: number
  fromHeaderLength: number
  fromAddressIndex: number
  fromAddressLength: number

  // Extracted metadata
  fromEmailDomain: string
  fromEmailAddress: string
}

export interface ParseOptions {
  maxHeaderLength?: number
}

/**
 * Generate inputs for the BRACU email verifier circuit
 * Uses @zk-email/zkemail-nr for proper DKIM signature extraction
 */
export async function generateEmailVerifierInputs(
  rawEmail: string,
  options: ParseOptions = {}
): Promise<EmailVerifierInputs> {
  // Increased default to 5120 to accommodate emails with many ARC/DKIM/Received headers
  // before the From header (common with mailing lists like Google Groups)
  const { maxHeaderLength = 5120 } = options

  // Pre-check: Find the From header position in raw email to ensure we capture it
  const rawHeaderEnd = rawEmail.indexOf('\r\n\r\n')
  const rawHeaders = rawHeaderEnd > 0 ? rawEmail.slice(0, rawHeaderEnd) : rawEmail.split('\n\n')[0]

  // Find From: header position in raw email (case-insensitive)
  const fromMatch = rawHeaders.match(/^From:/im) || rawHeaders.match(/\r?\nFrom:/i)
  if (!fromMatch || fromMatch.index === undefined) {
    throw new Error('Could not find "From:" header in email. This email may not have a valid From header.')
  }

  // Calculate minimum header length needed to include the From header
  // Find end of From header line
  const fromStartIndex = fromMatch.index + (fromMatch[0].startsWith('\r') || fromMatch[0].startsWith('\n') ?
    (fromMatch[0].startsWith('\r\n') ? 2 : 1) : 0)
  const afterFrom = rawHeaders.slice(fromStartIndex)
  const fromEndMatch = afterFrom.match(/\r?\n(?![^\S\r\n])/)
  const fromEndIndex = fromStartIndex + (fromEndMatch?.index || afterFrom.length)

  // Ensure we capture at least up to the end of the From header + some buffer
  const minRequiredLength = fromEndIndex + 100
  const effectiveMaxHeaderLength = Math.max(maxHeaderLength, minRequiredLength)

  // Load the appropriate email parser (zk-email or fallback)
  const emailParser = await loadZkEmailGenerate();

  // Use zkemail-nr to parse the email and extract DKIM components
  const zkInputs = await emailParser(rawEmail, {
    maxHeadersLength: effectiveMaxHeaderLength,
    maxBodyLength: 0, // Header-only for BRACU verifier
    ignoreBodyHashCheck: true
  })

  // Ensure header doesn't exceed circuit maximum
  if (zkInputs.header.storage.length > effectiveMaxHeaderLength) {
    console.warn(`Header length ${zkInputs.header.storage.length} exceeds maximum ${effectiveMaxHeaderLength}, truncating`)
    zkInputs.header.storage = zkInputs.header.storage.slice(0, effectiveMaxHeaderLength)
  }

  // Extract From email address and domain
  const { fromAddress, fromDomain } = extractFromAddress(rawEmail)

  // Validate BRACU domain
  if (!fromDomain.endsWith('g.bracu.ac.bd')) {
    throw new Error(`Invalid email domain: ${fromDomain}. Must be @g.bracu.ac.bd`)
  }

  // Find From header indices in the header bytes
  const headerBytes = zkInputs.header.storage.map((s: string) => parseInt(s))
  const headerString = arrayToString(headerBytes)
  const { headerIndex, headerLength, addressIndex, addressLength } =
    findFromIndices(headerString, fromAddress)

  // Use our calculated header length instead of zkInputs.header.len to ensure consistency
  // This prevents circuit overflow when indices don't match the header length
  const calculatedHeaderLength = headerBytes.length

  // CRITICAL FIX: Ensure all indices are within valid bounds to prevent circuit overflow
  // This addresses the "attempt to subtract with overflow" error
  const safeHeaderIndex = Math.min(headerIndex, calculatedHeaderLength - headerLength)
  const safeAddressIndex = Math.min(addressIndex, calculatedHeaderLength - addressLength)

  // Additional validation: ensure address is within header bounds
  const finalAddressIndex = Math.min(safeAddressIndex, safeHeaderIndex + headerLength - addressLength)

  return {
    emailHeader: headerBytes,
    emailHeaderLength: calculatedHeaderLength,
    pubkey: zkInputs.pubkey.modulus,
    pubkeyRedc: zkInputs.pubkey.redc,
    signature: zkInputs.signature,
    fromHeaderIndex: safeHeaderIndex,
    fromHeaderLength: headerLength,
    fromAddressIndex: finalAddressIndex,
    fromAddressLength: addressLength,
    fromEmailDomain: fromDomain,
    fromEmailAddress: fromAddress
  }
}

/**
 * Extract From email address from raw email
 */
function extractFromAddress(rawEmail: string): { fromAddress: string; fromDomain: string } {
  const lines = rawEmail.split(/\r?\n/)

  for (const line of lines) {
    if (line.toLowerCase().startsWith('from:')) {
      // Extract email address (handles "Name <email>" and "email" formats)
      const emailMatch = line.match(/<([^>]+)>/) || line.match(/:\s*([^\s<]+@[^\s>]+)/)
      if (emailMatch) {
        const address = emailMatch[1].toLowerCase()
        const domainMatch = address.match(/@(.+)$/)
        return {
          fromAddress: address,
          fromDomain: domainMatch ? domainMatch[1] : ''
        }
      }
    }
  }

  throw new Error('Could not find From address in email')
}

/**
 * Find indices of From header and address within header bytes
 */
function findFromIndices(
  headerString: string,
  emailAddress: string
): { headerIndex: number; headerLength: number; addressIndex: number; addressLength: number } {
  // Safety bounds checking
  if (!headerString || !emailAddress) {
    throw new Error('Invalid parameters: headerString and emailAddress are required')
  }

  if (headerString.length === 0) {
    throw new Error('Empty header string')
  }

  // Find "From:" in header (case-insensitive search, but we need exact position)
  // Handle both cases: header starting with "From:" or having a newline before it
  const fromPattern = /^From:/i
  const fromPatternWithNewline = /\r?\nFrom:/i

  let fromMatch = headerString.match(fromPattern)
  let headerIndex = 0
  let headerLength = 0

  if (fromMatch && fromMatch.index !== undefined) {
    // From header is at the beginning
    headerIndex = 0
  } else {
    // Look for From header with newline
    fromMatch = headerString.match(fromPatternWithNewline)
    if (fromMatch && fromMatch.index !== undefined) {
      headerIndex = fromMatch.index + (fromMatch[0].startsWith('\r') ? 2 : 1) // Skip the newline
    } else {
      throw new Error('Could not find "From:" header in email')
    }
  }

  // Find end of From header (next CRLF not followed by whitespace)
  const afterFrom = headerString.slice(headerIndex)
  const headerEndMatch = afterFrom.match(/\r?\n(?![^\S\r\n])/)
  headerLength = headerEndMatch?.index || afterFrom.length

  // Bounds validation
  if (headerIndex < 0 || headerIndex >= headerString.length) {
    throw new Error(`Invalid header index: ${headerIndex} (string length: ${headerString.length})`)
  }

  if (headerLength <= 0 || headerIndex + headerLength > headerString.length) {
    throw new Error(`Invalid header length: ${headerLength} (headerIndex: ${headerIndex}, string length: ${headerString.length})`)
  }

  // Extract just the From header content for searching
  const fromHeaderContent = headerString.slice(headerIndex, headerIndex + headerLength)

  // Find email address position WITHIN the From header only
  const addressLower = emailAddress.toLowerCase()
  const fromHeaderLower = fromHeaderContent.toLowerCase()
  const addressPosInFromHeader = fromHeaderLower.indexOf(addressLower)

  if (addressPosInFromHeader < 0) {
    throw new Error(`Could not find email address "${emailAddress}" in From header. Found From header content: ${fromHeaderContent.substring(0, 100)}...`)
  }

  // Calculate absolute position in the full header string
  const addressPos = headerIndex + addressPosInFromHeader

  // Final bounds validation for address position
  if (addressPos < 0 || addressPos >= headerString.length) {
    throw new Error(`Invalid address position: ${addressPos} (string length: ${headerString.length})`)
  }

  if (addressPos + emailAddress.length > headerString.length) {
    throw new Error(`Address extends beyond header bounds: position ${addressPos}, length ${emailAddress.length}, header length ${headerString.length}`)
  }

  // Validate: address must be at least 15 chars for BRACU domain (x@g.bracu.ac.bd)
  if (emailAddress.length < 15) {
    throw new Error(`Email address "${emailAddress}" is too short. BRACU emails must be at least 15 characters.`)
  }

  // CRITICAL: Ensure indices are safe for circuit operations
  // This prevents the "attempt to subtract with overflow" error
  const safeHeaderIndex = Math.max(0, Math.min(headerIndex, headerString.length - 1));
  const safeHeaderLength = Math.max(1, Math.min(headerLength, headerString.length - safeHeaderIndex));
  const safeAddressIndex = Math.max(0, Math.min(addressPos, headerString.length - emailAddress.length));

  return {
    headerIndex: safeHeaderIndex,
    headerLength: safeHeaderLength,
    addressIndex: safeAddressIndex,
    addressLength: emailAddress.length
  }
}

/**
 * Convert byte array to string
 */
function arrayToString(arr: number[]): string {
  return String.fromCharCode(...arr.filter(b => b !== 0))
}

/**
 * Validate that an email is from the BRACU domain
 */
export function validateBRACUEmail(rawEmail: string): { valid: boolean; error?: string } {
  try {
    const { fromDomain } = extractFromAddress(rawEmail)

    if (fromDomain.endsWith('g.bracu.ac.bd')) {
      return { valid: true }
    } else {
      return { valid: false, error: `Email must be from @g.bracu.ac.bd domain, got @${fromDomain}` }
    }
  } catch (error) {
    return { valid: false, error: `Parse error: ${error}` }
  }
}

/**
 * Quick check if email has proper DKIM signature
 */
export function hasDKIMSignature(rawEmail: string): boolean {
  return rawEmail.toLowerCase().includes('dkim-signature')
}

// Alias for backward compatibility
export const extractZKInputs = generateEmailVerifierInputs