import { defineKeyword } from "../../../../../../util-types/json-schema";
import { RosterLockV1Config } from "@roster-lock/types";

import { validatePieceRequirementList } from "../../validate/piece/requirements";
export const requirementListSchemaValidator = defineKeyword({
  keyword: "requirementList",
  type: "array",
  validate: validatePieceRequirementList
})

import { validatePieceInCycles } from "../../validate/piece/requirements";
export const requirementCycleSchemaValidator = defineKeyword({
  keyword: "requirementCycle",
  type: "array",
  validate: function(item: string, { engine }: RosterLockV1Config, path){
    // /engine/pieceDefinitions/pieceType/requires
    const parts = path.split("/").slice(0, -2);
    const pieceType = parts.at(-1);
    if(!pieceType) throw new Error("Invalid path");

    validatePieceInCycles(pieceType, engine);
  }
})

import { validatePieceRequirementIsResolved } from "../../validate/piece/requirements";
export const requirementItemSchemaValidator = defineKeyword({
  keyword: "requirementResolved",
  type: "string",
  validate: function(item: string, { engine }: RosterLockV1Config, path){
    // /engine/pieceDefinitions/pieceType/requires/index
    validatePieceRequirementIsResolved(item, engine);
  }
})

