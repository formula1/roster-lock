
export function buildIdentity<P extends string, V extends number>(
  purpose: P, version: V
){
  return {
    type: "object" as const, required: ["namespace", "purpose", "version"] as const,
    additionalProperties: false,
    properties: {
      namespace: { type: "string" as const, const: "roster-lock" as const },
      purpose: { type: "string" as const, const: purpose },
      version: { type: "number" as const, const: version },
    }
  };
}
