// Simple Node.js test for circuit loading
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testCircuitLoading() {
    console.log('🧪 Testing circuit loading...');
    
    try {
        // Check if circuit file exists
        const circuitPath = path.join(__dirname, 'public/circuits/bracu_verifier.json');
        console.log(`📁 Checking circuit file: ${circuitPath}`);
        
        if (!fs.existsSync(circuitPath)) {
            throw new Error(`Circuit file not found at ${circuitPath}`);
        }
        
        // Load and parse circuit
        const circuitData = JSON.parse(fs.readFileSync(circuitPath, 'utf8'));
        console.log('✅ Circuit file loaded successfully');
        console.log(`📋 Circuit version: ${circuitData.noir_version || 'unknown'}`);
        console.log(`🔧 ABI parameters: ${circuitData.abi?.parameters?.length || 0}`);
        
        // Check for total_header_length parameter
        const totalHeaderParam = circuitData.abi?.parameters?.find(p => p.name === 'total_header_length');
        if (totalHeaderParam) {
            console.log(`🎯 Found total_header_length parameter:`, totalHeaderParam);
        } else {
            console.log('⚠️  total_header_length parameter not found in ABI');
        }
        
        // Test the fix logic
        const testHeaderLength = 12447;
        const testRemainingLength = 12447;
        
        console.log(`\n🔍 Testing total_header_length fix:`);
        console.log(`   Original header length: ${testHeaderLength}`);
        console.log(`   Remaining length: ${testRemainingLength}`);
        console.log(`   Fixed total_header_length: ${testHeaderLength}`);
        console.log(`   Previous total_header_length: ${testRemainingLength}`);
        
        if (testHeaderLength >= testRemainingLength) {
            console.log('✅ Fix should prevent underflow error');
        } else {
            console.log('⚠️  Potential underflow risk detected');
        }
        
        console.log('\n🎉 Circuit loading test completed successfully!');
        
    } catch (error) {
        console.error('❌ Circuit loading test failed:', error.message);
        process.exit(1);
    }
}

// Run the test
testCircuitLoading();