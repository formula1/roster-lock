
import { JSON_Unknown, ENCRYPT_SYMMETRIC, SymmetricEncryptionKey } from "@roster-lock/utils";

import { JSONSchemaType } from "ajv";

export const encryptedSchema: JSONSchemaType<string> = {
  type: "string",
};


export async function encryptJSON(
  originalValue: JSON_Unknown
): Promise<{ key: SymmetricEncryptionKey, encryptedValue: string }> {
  const key = await ENCRYPT_SYMMETRIC.generateKey();
  const encryptedValue = await ENCRYPT_SYMMETRIC.encryptValue(key, originalValue);
  return {
    key: key,
    encryptedValue: encryptedValue
  };
}


export async function decryptJSON(
  keyString: string, encryptedValue: string
): Promise<JSON_Unknown> {
  return await ENCRYPT_SYMMETRIC.decryptValue(
    keyString as SymmetricEncryptionKey, encryptedValue
  ) as JSON_Unknown;
}
