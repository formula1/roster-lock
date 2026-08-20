import { RoomConfig } from "@roster-lock/types";
import { SIGNATURE_ASYMMETRIC } from "@roster-lock/utils";

type PublicKey = Parameters<typeof SIGNATURE_ASYMMETRIC.verifySignature>[0];

type UserMessage = {
  roomId: string;
  timestamp: number;
  publicKey: string;
  signature: string;
};

export function searchParamsToUserMessage(searchParams: URLSearchParams): UserMessage | null {
  try {
    const roomId = searchParams.get("room");
    const timestampStr = searchParams.get("t");
    const publicKey = searchParams.get("pk");
    const signature = searchParams.get("sig");
    if (!roomId || !timestampStr || !publicKey || !signature) return null;
    const timestamp = Number.parseInt(timestampStr);
    if (Number.isNaN(timestamp)) return null;
    return { roomId, timestamp, publicKey, signature };
  } catch (error) {
    return null;
  }
}

const MAX_DRIFT = 10 * 1000; // 10 seconds
const MAX_MESSAGE_AGE = 30 * 1000; // 30 seconds

export async function validateAuth(
  userMessage: UserMessage,
  roomInfo: RoomConfig,
  serviceName: string,
) {
  // Wrong Room
  if (userMessage.roomId !== roomInfo.roomId) return null;
  const now = Date.now();
  // Invalid Timestamp
  if (userMessage.timestamp > now + MAX_DRIFT) return null;
  // Too Old
  if (userMessage.timestamp < now - MAX_MESSAGE_AGE) return null;

  // Machine not found
  const machine = roomInfo.machines.find(m => m.publicKey === userMessage.publicKey);
  if (!machine) return null;

  // Invalid Signature
  const isValid = await SIGNATURE_ASYMMETRIC.verifySignature(
    userMessage.publicKey as PublicKey,
    userMessage.signature,
    {
      service: serviceName,
      roomId: userMessage.roomId,
      publicKey: userMessage.publicKey,
      timestamp: userMessage.timestamp,
    }
  );

  if (!isValid) return null;

  return machine;
}

export async function validateAuthFromSearch(
  searchParams: URLSearchParams,
  roomInfo: RoomConfig,
  serviceName: string,
) {
  const userMessage = searchParamsToUserMessage(searchParams);
  if (!userMessage) return null;
  return validateAuth(userMessage, roomInfo, serviceName);
}
