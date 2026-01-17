/**
 * Convert mnemonic phrase to Ed25519 private key (Base64)
 * 
 * Usage:
 *   npm run mnemonic-to-key "your mnemonic phrase here"
 * 
 * WARNING: Never commit mnemonic phrases or private keys to git!
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { toB64 } from '@mysten/sui/utils';

function convertMnemonicToKey(mnemonic: string): void {
    try {
        // Derive Ed25519 keypair from mnemonic
        // Sui uses BIP-44 derivation path: m/44'/784'/0'/0'/0'
        const keypair = Ed25519Keypair.deriveKeypair(mnemonic);
        
        const address = keypair.getPublicKey().toSuiAddress();
        
        // Get secret key in Bech32 format, then decode to raw 32-byte secret
        const bech32SecretKey = keypair.getSecretKey();
        const { secretKey: rawSecretKey } = decodeSuiPrivateKey(bech32SecretKey);
        
        // rawSecretKey is now Uint8Array of 32 bytes
        const secretKeyBase64 = toB64(rawSecretKey);

        console.log('='.repeat(60));
        console.log('MNEMONIC → PRIVATE KEY CONVERSION');
        console.log('='.repeat(60));
        console.log('');
        console.log('Address:', address);
        console.log('');
        console.log('Private Key (Base64):');
        console.log(secretKeyBase64);
        console.log('');
        console.log('='.repeat(60));
        console.log('ADD TO .env:');
        console.log('='.repeat(60));
        console.log('');
        console.log('For Gas Station:');
        console.log(`GAS_STATION_PRIVATE_KEY=${secretKeyBase64}`);
        console.log('');
        console.log('For Relayer:');
        console.log(`RELAYER_PRIVATE_KEY=${secretKeyBase64}`);
        console.log('');
        console.log('WARNING: Never commit private keys to git!');
        console.log('='.repeat(60));
    } catch (error) {
        console.error('Error converting mnemonic:', error);
        console.error('');
        console.error('Make sure mnemonic is valid (12 words, space-separated)');
        process.exit(1);
    }
}

// Get mnemonic from command line argument
const mnemonic = process.argv[2];

if (!mnemonic) {
    console.error('Usage: npm run mnemonic-to-key "your mnemonic phrase here"');
    console.error('');
    console.error('Example:');
    console.error('  npm run mnemonic-to-key "word1 word2 word3 ... word12"');
    process.exit(1);
}

convertMnemonicToKey(mnemonic);
