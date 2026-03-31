import { JSON_Unknown } from "@match-lock/shared";
import { Ajv, JSONSchemaType } from "ajv";

export function validateUnknown<T>(schema: JSONSchemaType<T>, data: JSON_Unknown): T {
  const ajv = new Ajv();
  const validate = ajv.compile(schema);
  if(!validate(data)){
    throw new Error("Invalid Data");
  }
  return data;
}
