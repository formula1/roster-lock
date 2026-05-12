import { defineKeyword } from "../../../../../../util-types/json-schema";
import { RosterLockV1Config } from "@roster-lock/types";


import { validateAssetName } from "../../validate/piece/assets";
export const assetNameSchemaValidator = defineKeyword({
  keyword: "assetName",
  type: "string",
  validate: function(name: string, { engine }: RosterLockV1Config, path){
    // /engine/pieceDefinitions/pieceType/assets/index/name
    const pathParts = path.split("/").slice(0, -4);
    const pieceType = pathParts.at(-1);
    if(!pieceType) throw new Error("Invalid path");
    const assets = engine.pieceDefinitions[pieceType].assets;
    validateAssetName(name, assets);
  }
});

import { validateGlobList } from "../../validate/piece/assets";
export const assetGlobListSchemaValidator = defineKeyword({
  keyword: "assetGlobList",
  type: "array",
  validate: validateGlobList
});

import { validatePathVariablesInGlob } from "../../validate/piece/assets/glob/pathvariables";
export const assetGlobPathVariablesSchemaValidator = defineKeyword({
  keyword: "assetGlobPathVariables",
  type: "string",
  validate: function(globItem: string, { engine }: RosterLockV1Config, path){
    // /engine/pieceDefinitions/pieceType/assets/index/glob/index
    const pathParts = path.split("/").slice(0, -5);
    const pieceType = pathParts.at(-1);
    if(!pieceType) throw new Error("Invalid path");
    const variables = engine.pieceDefinitions[pieceType].pathVariables;
    validatePathVariablesInGlob(globItem, variables);
  },
});

import { validateGlobItem } from "../../validate/piece/assets/glob";
export const assetGlobItemSchemaValidator = defineKeyword({
  keyword: "assetGlobItem",
  type: "string",
  validate: validateGlobItem
});



