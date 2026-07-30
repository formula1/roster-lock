import { JSONSchemaType } from "ajv";
import { defineKeyword } from "../../../../../util-types/json-schema";
import { RosterLockV1Config } from "@roster-lock/types";
import { sha256SchemaValidator } from "../../rosters/caster-json-schema/version";

export const officialSelectionHashUniquenessSchemaValidator = defineKeyword({
  keyword: "officialSelectionHashUniqueness",
  type: "string",
  validate: function (hash: string, { engine }: RosterLockV1Config, path){
    // /engine/officialSelections/index/hash
    const index = Number(path.split("/").at(-2));
    if(Number.isNaN(index)) throw new Error("Invalid path: index is not a number");
    const list = engine.officialSelections ?? [];
    for(let i = 0; i < list.length; i++){
      if(i === index) continue;
      if(list[i].hash === hash) throw new Error(`Duplicate official selection hash ${hash}`);
    }
  }
});

export const officialSelectionsSchema: JSONSchemaType<
  NonNullable<RosterLockV1Config["engine"]["officialSelections"]>
> = {
  type: "array",
  items: {
    type: "object",
    required: ["tag", "hash"],
    additionalProperties: false,
    properties: {
      tag: { type: "string" },
      hash: {
        type: "string",
        [sha256SchemaValidator.keyword]: true,
        [officialSelectionHashUniquenessSchemaValidator.keyword]: true,
      },
    },
  },
};

export const officialSelectionsKeywords = [
  officialSelectionHashUniquenessSchemaValidator,
];
