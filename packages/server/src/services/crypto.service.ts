import nacl from 'tweetnacl';

export class CryptoService {
  private publicKey: Uint8Array | null = null;
  private secretKey: Uint8Array | null = null;

  generateKeyPair(): { publicKey: string; secretKey: string } {
    const keyPair = nacl.sign.keyPair();
    this.publicKey = keyPair.publicKey;
    this.secretKey = keyPair.secretKey;
    return {
      publicKey: Buffer.from(keyPair.publicKey).toString('base64'),
      secretKey: Buffer.from(keyPair.secretKey).toString('base64'),
    };
  }

  loadKeyPair(publicKey: string, secretKey: string): void {
    this.publicKey = new Uint8Array(Buffer.from(publicKey, 'base64'));
    this.secretKey = new Uint8Array(Buffer.from(secretKey, 'base64'));
  }

  sign(message: string): string {
    if (!this.secretKey) {
      throw new Error('No key pair loaded. Call generateKeyPair() or loadKeyPair() first.');
    }
    const messageBytes = new TextEncoder().encode(message);
    const signature = nacl.sign.detached(messageBytes, this.secretKey);
    return Buffer.from(signature).toString('base64');
  }

  verify(message: string, signature: string, publicKey: string): boolean {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = new Uint8Array(Buffer.from(signature, 'base64'));
    const publicKeyBytes = new Uint8Array(Buffer.from(publicKey, 'base64'));
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  }

  getPublicKey(): string {
    if (!this.publicKey) {
      throw new Error('No key pair loaded. Call generateKeyPair() or loadKeyPair() first.');
    }
    return Buffer.from(this.publicKey).toString('base64');
  }
}

export const cryptoService = new CryptoService();
