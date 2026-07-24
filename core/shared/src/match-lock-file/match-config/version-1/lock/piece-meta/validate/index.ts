import Ajv, { JSONSchemaType } from "ajv";
import {
  RosterLockV1Config, PieceType, JSONShallowObject, SelectionPieceMeta
} from "@roster-lock/types";
import { cloneJSON } from "@roster-lock/utils";

export function validatePieceMeta(
  config: RosterLockV1Config
){
  for(const [pieceType, meta] of Object.entries(config.pieceMeta)){
    validatePieceMetaConfig(meta, pieceType, config);
  }
}

export function validatePieceMetaConfig(
  meta: SelectionPieceMeta<any>,
  pieceType: PieceType,
  { engine, rosters }: RosterLockV1Config
){
  const pieceDefinition = engine.pieceDefinitions[pieceType];
  if(!pieceDefinition){
    throw new Error(`Piece type ${pieceType} is not defined in engine`);
  }
  const roster = rosters[pieceType];
  if(!roster){
    throw new Error(`Piece type ${pieceType} is not defined in roster`);
  }

  validateMetaDefaultValue(meta.schema, meta.defaultMeta);

  for(const [pieceId, pieceValue] of Object.entries(meta.values)){
    validateMetaForPiece(meta.schema, pieceId, pieceValue, roster);
  }
}

function simpleSchemaToJSONSchemaType(schema: SelectionPieceMeta<any>["schema"]): JSONSchemaType<JSONShallowObject> {
  const required: Array<string> = [];
  const properties: Record<string, JSONSchemaType<(
    | boolean | number | string
    | Array<boolean> | Array<number> | Array<string>
  )>> = {};
  for(const [key, value] of Object.entries(schema)){
    required.push(key);
    switch(value){
      case "boolean":
        properties[key] = { type: "boolean" };
        break;
      case "number":
        properties[key] = { type: "number" };
        break;
      case "string":
        properties[key] = { type: "string" };
        break;
      case "boolean[]":
        properties[key] = { type: "array", items: { type: "boolean" } };
        break;
      case "number[]":
        properties[key] = { type: "array", items: { type: "number" } };
        break;
      case "string[]":
        properties[key] = { type: "array", items: { type: "string" } };
        break;
    }
  }

  const jsonSchema: JSONSchemaType<JSONShallowObject> = {
    type: "object",
    required,
    additionalProperties: false,
    properties,
  };

  return jsonSchema;
}

export function validateMetaDefaultValue(
  simpleSchema: SelectionPieceMeta<any>["schema"],
  meta: SelectionPieceMeta<any>["defaultMeta"]
){
  const metaSchema = simpleSchemaToJSONSchemaType(simpleSchema);
  const defaultMeta = Object.keys(meta);
  if(defaultMeta.length !== metaSchema.required.length){
    throw new Error(`Piece meta default meta must have all required keys`);
  }
  for(const key of metaSchema.required){
    if(!defaultMeta.includes(key)){
      throw new Error(`Piece meta default meta must have all required keys`);
    }
  }
  const ajv = new Ajv();
  if(!ajv.validate(metaSchema, meta)){
    throw new Error(`Piece meta default meta does not match schema`);
  }
}

export function validateMetaForPiece(
  simpleSchema: SelectionPieceMeta<any>["schema"],
  pieceId: string,
  meta: SelectionPieceMeta<any>["values"][string],
  roster: RosterLockV1Config["rosters"][string]
){
  const metaSchema = simpleSchemaToJSONSchemaType(simpleSchema);
  const piece = roster.find(p=>p.id === pieceId);
  if(!piece){
    throw new Error(`Piece meta references piece ${pieceId} which is not in the roster`);
  }

  const cloned = cloneJSON(metaSchema);
  cloned.required = [];
  const ajv = new Ajv();
  if(!ajv.validate(cloned, meta)){
    throw new Error(`Piece meta does not match schema`);
  }
}
