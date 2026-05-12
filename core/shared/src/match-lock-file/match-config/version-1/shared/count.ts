
import { JSONSchemaType } from "ajv";
import { Count } from "@roster-lock/types";
import { defineKeyword } from "../../../util-types/json-schema";

export const countSchemaValidator = defineKeyword({
  keyword: "assetCount",
  type: ["number", "string", "array"],
  validate: validateCount
});


export const countSchema: JSONSchemaType<Count> = {
  [countSchemaValidator.keyword]: true,
  type: ["number", "string", "array"],
  anyOf: [
    { type: "number", minimum: 1 },
    { type: "string", const: "*" },
    {
      type: "array",
      items: [
        { type: "number", minimum: 0 },
        { anyOf: [{ type: "number", minimum: 1 }, { type: "string", const: "*" }] },
      ],
      minItems: 2,
      maxItems: 2,
    },
  ],
};

export function validateCount(count: Count){
  if(!Array.isArray(count)){
    if(count === "*") return;
    if(count <= 0) throw new Error("count should be greater than 0");
    return;
  }
  if(count.length !== 2){
    throw new Error("range should be a single value or a range of two values");
  }
  if(count[0] < 0){
    throw new Error("range should not have a negative minimum");
  }
  if(count[1] === "*") return;
  if(count[0] >= count[1]){
    throw new Error("maximum should be greater than the minimum");
  }
}
