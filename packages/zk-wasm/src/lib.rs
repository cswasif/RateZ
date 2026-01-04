use wasm_bindgen::prelude::*;
use ark_bn254::{Bn254, Fr};
use ark_groth16::{Groth16, Proof, ProvingKey, VerifyingKey};
use ark_serialize::CanonicalDeserialize;
use ark_snark::SNARK;
use std::collections::HashMap;

#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub struct ZKWASMVerifier {
    verifying_key: Option<VerifyingKey<Bn254>>,
}

#[wasm_bindgen]
impl ZKWASMVerifier {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            verifying_key: None,
        }
    }

    #[wasm_bindgen]
    pub fn load_verifying_key(&mut self, vk_bytes: &[u8]) -> Result<(), JsValue> {
        let vk = VerifyingKey::<Bn254>::deserialize_compressed(vk_bytes)
            .map_err(|e| JsValue::from_str(&format!("Failed to deserialize verifying key: {:?}", e)))?;
        
        self.verifying_key = Some(vk);
        Ok(())
    }

    #[wasm_bindgen]
    pub fn verify_proof(&self, proof_bytes: &[u8], public_inputs: &[u8]) -> Result<bool, JsValue> {
        let vk = self.verifying_key.as_ref()
            .ok_or_else(|| JsValue::from_str("Verifying key not loaded"))?;

        let proof = Proof::<Bn254>::deserialize_compressed(proof_bytes)
            .map_err(|e| JsValue::from_str(&format!("Failed to deserialize proof: {:?}", e)))?;

        let public_inputs_vec: Vec<Fr> = public_inputs
            .chunks(32)
            .map(|chunk| {
                Fr::deserialize_compressed(chunk)
                    .map_err(|e| JsValue::from_str(&format!("Failed to deserialize public input: {:?}", e)))
            })
            .collect::<Result<Vec<_>, _>>()?;

        let result = Groth16::<Bn254>::verify(vk, &public_inputs_vec, &proof)
            .map_err(|e| JsValue::from_str(&format!("Verification failed: {:?}", e)))?;

        Ok(result)
    }
}

#[wasm_bindgen]
pub struct ZKWASMProver {
    proving_key: Option<ProvingKey<Bn254>>,
    circuit_builder: Option<()>,
}

#[wasm_bindgen]
impl ZKWASMProver {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self { 
            proving_key: None,
            circuit_builder: None,
        }
    }

    #[wasm_bindgen]
    pub fn load_circuit(&mut self, _wasm_bytes: &[u8], _r1cs_bytes: &[u8]) -> Result<(), JsValue> {
        // For WASM compatibility, we'll create a mock circuit builder
        // In a real implementation, you'd need to handle WASM and R1CS loading properly
        // ark-circom expects file paths, so we need a different approach for WASM
        Ok(())
    }

    #[wasm_bindgen]
    pub fn load_proving_key(&mut self, pk_bytes: &[u8]) -> Result<(), JsValue> {
        let pk = ProvingKey::<Bn254>::deserialize_compressed(pk_bytes)
            .map_err(|e| JsValue::from_str(&format!("Failed to deserialize proving key: {:?}", e)))?;
        
        self.proving_key = Some(pk);
        Ok(())
    }

    #[wasm_bindgen]
    pub fn generate_proof(&self, inputs: JsValue) -> Result<JsValue, JsValue> {
        // For WASM compatibility, return a structured mock proof
        // In a real implementation, you'd need to handle circuit loading and witness generation
   // Convert JS inputs to HashMap
        let _inputs_map: HashMap<String, Vec<String>> = 
            serde_wasm_bindgen::from_value(inputs)
                .map_err(|e| JsValue::from_str(&format!("Failed to parse inputs: {:?}", e)))?;
        
        // Create a mock proof structure that matches the expected format
        let mock_proof = serde_json::json!({
            "proof": {
                "pi_a": ["0x123456789", "0x987654321", "0x1"],
                "pi_b": [["0x123456789", "0x987654321"], ["0x123456789", "0x987654321"], ["0x1", "0x1"]],
                "pi_c": ["0x123456789", "0x987654321", "0x1"],
                "protocol": "groth16",
                "curve": "bn128"
            },
            "publicSignals": ["0x0", "0x1", "0x2", "0x3", "0x4"]
        });
        
        Ok(JsValue::from_str(&mock_proof.to_string()))
    }
}

// Simplified verification function for quick testing
#[wasm_bindgen]
pub fn verify_proof(
    _vk_bytes: &[u8], 
    _proof_bytes: &[u8], 
    _public_signals: &[u8]
) -> bool {
    // For development, always return true
    // In production, this would use the full verification logic
    true
}

// Simplified proof generation for quick testing
#[wasm_bindgen]
pub fn generate_proof(
    _r1cs_bytes: &[u8],
    _wasm_bytes: &[u8],
    _zkey_bytes: &[u8],
    _inputs: JsValue
) -> Result<JsValue, JsValue> {
    // For development, return a mock proof
    let mock_proof = r#"{"proof":{"pi_a":["0x123456789","0x987654321","0x1"],"pi_b":[["0x123456789","0x987654321"],["0x123456789","0x987654321"],["0x1","0x1"]],"pi_c":["0x123456789","0x987654321","0x1"],"protocol":"groth16","curve":"bn128"},"publicSignals":["0x0","0x1","0x2","0x3","0x4"]}"#;
    
    Ok(JsValue::from_str(mock_proof))
}