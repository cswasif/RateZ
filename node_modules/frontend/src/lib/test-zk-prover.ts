// Test ZK Prover functionality
import { loadCircuitFromUrl, generateBRACUProof } from './zk-prover'
import { testWASMModule } from './test-wasm'

export async function testZKProver(): Promise<{ success: boolean; circuitLoaded?: boolean; wasmWorking?: boolean; proofGenerated?: boolean; error?: string; details?: any }> {
    console.log('🧪 Testing ZK Prover functionality...');
    
    const results = {
        success: false,
        circuitLoaded: false,
        wasmWorking: false,
        proofGenerated: false,
        error: '',
        details: {} as any
    };
    
    try {
        // Step 1: Test WASM module
        console.log('1️⃣ Testing WASM module...');
        const wasmTest = await testWASMModule();
        results.details.wasmTest = wasmTest;
        
        if (!wasmTest.success) {
            results.error = `WASM test failed: ${wasmTest.error}`;
            return results;
        }
        results.wasmWorking = true;
        console.log('✅ WASM module working');
        
        // Step 2: Load circuit
        console.log('2️⃣ Loading circuit...');
        try {
            await loadCircuitFromUrl('/circuits/bracu_verifier.json');
            results.circuitLoaded = true;
            console.log('✅ Circuit loaded successfully');
        } catch (error) {
            results.error = `Circuit loading failed: ${error instanceof Error ? error.message : String(error)}`;
            results.details.circuitError = error;
            return results;
        }
        
        // Step 3: Test proof generation with sample email
        console.log('3️⃣ Testing proof generation...');
        const testEmail = `From: fahim.farhan@bracu.ac.bd
To: test@example.com
Subject: Test Email for ZK Proof
Date: Mon, 05 Jan 2026 09:00:00 +0000
Message-ID: <test123@bracu.ac.bd>

This is a test email for ZK proof generation.`;
        
        try {
            const proofResult = await generateBRACUProof(testEmail);
            
            results.proofGenerated = true;
            results.details.proofResult = {
                proofLength: proofResult.proof.length,
                publicInputsLength: proofResult.publicInputs.length,
                verificationKeyLength: (proofResult as any).verificationKey?.length || 0
            };
            console.log('✅ Proof generated successfully');
            console.log('📊 Proof details:', results.details.proofResult);
            
        } catch (error) {
            results.error = `Proof generation failed: ${error instanceof Error ? error.message : String(error)}`;
            results.details.proofError = error;
            return results;
        }
        
        results.success = true;
        console.log('🎉 All tests passed!');
        return results;
        
    } catch (error) {
        results.error = `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
        results.details.unexpectedError = error;
        return results;
    }
}

// Test function that can be called from the browser
(window as any).testZKProver = testZKProver;

// Auto-run test when module is loaded
if (typeof window !== 'undefined') {
    console.log('🚀 ZK Prover test module loaded. Call window.testZKProver() to run tests.');
}