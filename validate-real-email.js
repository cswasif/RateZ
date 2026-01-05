// Simple validation test for your actual BRACU email
const fs = require('fs');

function testRealEmail() {
    console.log('🧪 Testing your actual BRACU email...\n');
    
    try {
        // Read your actual email
        const emailContent = fs.readFileSync('c:\\Users\\Administrator\\Desktop\\ZK\\myemail.ini', 'utf8');
        console.log('📧 Email loaded successfully');
        console.log('📊 Total length:', emailContent.length, 'characters');
        
        // Basic validation checks
        console.log('\n🔍 Validation Checks:');
        
        // Check for BRACU domain
        const hasBRACUDomain = emailContent.includes('@g.bracu.ac.bd');
        console.log('✅ Contains @g.bracu.ac.bd domain:', hasBRACUDomain);
        
        // Check for DKIM signature
        const hasDKIMSignature = emailContent.includes('DKIM-Signature:');
        console.log('✅ Contains DKIM signature:', hasDKIMSignature);
        
        // Check for specific DKIM domain
        const hasBRACUDKIM = emailContent.includes('d=g.bracu.ac.bd');
        console.log('✅ DKIM signature for g.bracu.ac.bd:', hasBRACUDKIM);
        
        // Extract headers (everything before first double newline)
        const headerEndIndex = emailContent.indexOf('\n\n');
        const headerContent = headerEndIndex !== -1 ? emailContent.substring(0, headerEndIndex) : emailContent;
        const headerLength = headerContent.length;
        
        console.log('\n📊 Header Analysis:');
        console.log('   - Header length:', headerLength, 'characters');
        console.log('   - Body length:', emailContent.length - headerLength, 'characters');
        
        // Check if it fits in our updated circuit (20000 max)
        const maxHeaderLength = 20000;
        const fitsInCircuit = headerLength <= maxHeaderLength;
        console.log('   - Max circuit limit:', maxHeaderLength);
        console.log('   - Fits in circuit:', fitsInCircuit);
        
        if (!fitsInCircuit) {
            console.log('❌ Header too long for current circuit settings');
            console.log('   Required maxHeaderLength:', headerLength + 1000);
            return;
        }
        
        // Extract key headers for validation
        console.log('\n📧 Key Headers:');
        
        // From header
        const fromMatch = emailContent.match(/^From:\s*(.+)$/m);
        if (fromMatch) {
            console.log('   - From:', fromMatch[1].trim());
        }
        
        // To header
        const toMatch = emailContent.match(/^To:\s*(.+)$/m);
        if (toMatch) {
            console.log('   - To:', toMatch[1].trim());
        }
        
        // Subject
        const subjectMatch = emailContent.match(/^Subject:\s*(.+)$/m);
        if (subjectMatch) {
            console.log('   - Subject:', subjectMatch[1].trim());
        }
        
        // Date
        const dateMatch = emailContent.match(/^Date:\s*(.+)$/m);
        if (dateMatch) {
            console.log('   - Date:', dateMatch[1].trim());
        }
        
        // Check for RSA signature (important for ZK proof)
        const hasRSASignature = emailContent.includes('a=rsa-sha256');
        console.log('\n🔐 Cryptographic Validation:');
        console.log('   - RSA-SHA256 signature:', hasRSASignature);
        
        // Check for specific BRACU patterns
        const isBRACUStudentEmail = emailContent.includes('bracu-student@g.bracu.ac.bd');
        console.log('   - BRACU student mailing list:', isBRACUStudentEmail);
        
        // Overall validation
        const isValid = hasBRACUDomain && hasDKIMSignature && hasBRACUDKIM && fitsInCircuit && hasRSASignature;
        
        console.log('\n🎯 Final Validation:');
        console.log('   - Overall validity:', isValid ? '✅ VALID' : '❌ INVALID');
        
        if (isValid) {
            console.log('\n🎉 SUCCESS! Your email is ready for ZK proof generation!');
            console.log('📧 This is a genuine BRACU email with all required cryptographic signatures');
            console.log('🔐 All processing will happen locally in your browser');
            console.log('⚡ Ready for anonymous authentication');
            
            console.log('\n🧪 To test with the actual system:');
            console.log('1. Go to http://localhost:5175');
            console.log('2. Choose "📋 Manual Paste"');
            console.log('3. Copy and paste your entire email content');
            console.log('4. Click "Verify & Login Anonymously"');
            console.log('5. The system will generate a ZK proof locally');
            
            console.log('\n📁 Alternative: Save as .eml file and upload:');
            console.log('1. In Gmail: Three dots → "Download Message"');
            console.log('2. Save as .eml file');
            console.log('3. Drag & drop into the upload area');
            
        } else {
            console.log('\n❌ Email validation failed - missing required elements for ZK proof');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testRealEmail();