import { SIGNATURE } from "@roster-lock/utils";

export type UserKeyPair = {
  publicKey: string,
  privateKey: string,
};

export async function generateKeyPair(): Promise<UserKeyPair> {
  const { privateSigningKey, publicVerificationKey } = await SIGNATURE.ASYMMETRIC.generateKeyPair();
  return { privateKey: privateSigningKey, publicKey: publicVerificationKey };
}
