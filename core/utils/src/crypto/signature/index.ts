import { SIGNATURE_ASYMMETRIC } from "./asymmetric";
import { SIGNATURE_SYMMETRIC } from "./symmetric";

export * from "./asymmetric";
export * from "./symmetric";
export const SIGNATURE = {
  ASYMMETRIC: SIGNATURE_ASYMMETRIC,
  SYMMETRIC: SIGNATURE_SYMMETRIC
}