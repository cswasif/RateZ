import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function deploy() {
    const circuitPath = path.join(__dirname, '../bracu_verifier-circuit/bracu_verifier.json');

    if (!fs.existsSync(circuitPath)) {
        console.error('Error: Circuit file not found at:', circuitPath);
        return;
    }

    console.log('Reading circuit from:', circuitPath);
    const circuit = JSON.parse(fs.readFileSync(circuitPath, 'utf8'));

    if (!circuit.bytecode) {
        console.error('Error: No bytecode found in circuit file');
        return;
    }

    console.log('Bytecode found, length:', circuit.bytecode.length);

    const apiUrl = 'http://127.0.0.1:8787/api/auth/upload-circuit';
    console.log('Uploading to:', apiUrl);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bytecode: circuit.bytecode })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Upload successful:', result);
    } catch (e) {
        console.error('❌ Upload failed:', e.message);
        console.log('\nMake sure the API is running! Try:\ncd packages/api && npm run dev');
    }
}

deploy();
