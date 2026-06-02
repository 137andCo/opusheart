import { generateSigningKeyPair, signMessage, verifyMessage } from '@opusheart/connect';

/**
 * Stateful wrapper around the Ed25519 primitives in @opusheart/connect — it
 * holds this instance's loaded keypair (base64) so the federation service can
 * sign without threading keys through every call. The algorithm itself lives in
 * the connect protocol package.
 */
export class CryptoService {
  private publicKey: string | null = null;
  private secretKey: string | null = null;

  generateKeyPair(): { publicKey: string; secretKey: string } {
    const kp = generateSigningKeyPair();
    this.publicKey = kp.publicKey;
    this.secretKey = kp.secretKey;
    return kp;
  }

  loadKeyPair(publicKey: string, secretKey: string): void {
    this.publicKey = publicKey;
    this.secretKey = secretKey;
  }

  sign(message: string): string {
    if (!this.secretKey) {
      throw new Error('No key pair loaded. Call generateKeyPair() or loadKeyPair() first.');
    }
    return signMessage(message, this.secretKey);
  }

  verify(message: string, signature: string, publicKey: string): boolean {
    return verifyMessage(message, signature, publicKey);
  }

  getPublicKey(): string {
    if (!this.publicKey) {
      throw new Error('No key pair loaded. Call generateKeyPair() or loadKeyPair() first.');
    }
    return this.publicKey;
  }
}

export const cryptoService = new CryptoService();
