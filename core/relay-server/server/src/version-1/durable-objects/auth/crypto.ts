
import { canonicalJSONStringify } from "../../../utils/json";


import { verify as ed25519Verify } from "@noble/ed25519";
export async function verifySignature(publicKeyBase64: string, signatureBase64: string, message: any){
  try {
    const publicKey = Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0));
    const signature = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));

    const messageBytes = new TextEncoder().encode(canonicalJSONStringify(message));
    
    const isValid = await ed25519Verify(signature, messageBytes, publicKey);

    return isValid;
  }catch(e){
    return false;
  }
}
