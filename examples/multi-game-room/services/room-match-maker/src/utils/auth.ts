
import { Request, Response, NextFunction } from "express";
import { SIGNATURE } from "@roster-lock/utils";
import { ADMIN_API_KEY } from "../globals/env";

export function requireAdmin(req: Request, res: Response, next: NextFunction){
  if(req.headers.authorization !== `Bearer ${ADMIN_API_KEY}`){
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

type PublicKey = Parameters<typeof SIGNATURE.ASYMMETRIC.verifySignature>[0];

const MAX_TIMESTAMP_AGE_MS = 1000;
export async function verifyUserSignature(
  publicKey: string,
  signature: string,
  timestamp: number,
  payload: Record<string, unknown>,
): Promise<boolean> {
  if(Date.now() - timestamp > MAX_TIMESTAMP_AGE_MS) return false;
  return SIGNATURE.ASYMMETRIC.verifySignature(publicKey as PublicKey, signature, payload);
}
