/**
 * Email Parser for ZK Email Verification
 * 
 * Parses raw email content (MIME format) and generates inputs for
 * the BRACU email verification circuit using @zk-email/zkemail-nr.
 */

import { generateEmailVerifierInputs as zkEmailGenerate } from '@zk-email/zkemail-nr'

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
  const { maxHeaderLength = 512 } = options

  // Use zkemail-nr to parse the email and extract DKIM components
  const zkInputs = await zkEmailGenerate(rawEmail, {
    maxHeaderLength,
    maxBodyLength: 0, // Header-only for BRACU verifier
    ignoreBodyHashCheck: true
  })

  // Extract From email address and domain
  const { fromAddress, fromDomain } = extractFromAddress(rawEmail)

  // Validate BRACU domain
  if (!fromDomain.endsWith('g.bracu.ac.bd')) {
    throw new Error(`Invalid email domain: ${fromDomain}. Must be @g.bracu.ac.bd`)
  }

  // Find From header indices in the header bytes
  const headerString = arrayToString(zkInputs.header.storage)
  const { headerIndex, headerLength, addressIndex, addressLength } =
    findFromIndices(headerString, fromAddress)

  return {
    emailHeader: zkInputs.header.storage,
    emailHeaderLength: parseInt(zkInputs.header.len),
    pubkey: zkInputs.pubkey.modulus,
    pubkeyRedc: zkInputs.pubkey.redc_param,
    signature: zkInputs.signature,
    fromHeaderIndex: headerIndex,
    fromHeaderLength: headerLength,
    fromAddressIndex: addressIndex,
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
  // Find "from:" in header (case-insensitive search, but we need exact position)
  const fromPattern = /\r?\nfrom:/i
  const fromMatch = headerString.match(fromPattern)

  let headerIndex = 0
  let headerLength = 0

  if (fromMatch && fromMatch.index !== undefined) {
    headerIndex = fromMatch.index + (fromMatch[0].startsWith('\r') ? 2 : 1) // Skip the newline

    // Find end of From header (next CRLF not followed by whitespace)
    const afterFrom = headerString.slice(headerIndex)
    const headerEndMatch = afterFrom.match(/\r?\n(?![^\S\r\n])/)
    headerLength = headerEndMatch?.index || afterFrom.length
  }

  // Find email address position
  const addressLower = emailAddress.toLowerCase()
  const headerLower = headerString.toLowerCase()
  const addressPos = headerLower.indexOf(addressLower)

  return {
    headerIndex,
    headerLength,
    addressIndex: addressPos >= 0 ? addressPos : 0,
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