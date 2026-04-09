import { useState, useEffect, useCallback } from "react";
import type { InputProps } from "../../../../../../../utils/react";

import { EngineAssetDefinition } from "@roster-lock/types";
import { validateRange } from "@roster-lock/shared";

import { ToolTipSpan } from "../../../../../../../components/ToolTip";
import { InputError } from "../../../../../../../components/InputError";
import explainTT from "./explain.md";

type Count = EngineAssetDefinition["count"];

export function CountUnknownInput({ value, onChange }: InputProps<Count>){
  const [valueOrRange, setValueOrRange] = useState<"value" | "range">(Array.isArray(value) ? "range" : "value");
  return <>
    <h3><ToolTipSpan tip={explainTT} clickable>Count</ToolTipSpan></h3>
    <div style={{ display: "flex", gap: "1rem" }}>
      <label>
        <input type="radio" checked={valueOrRange === "value"} onChange={()=> setValueOrRange("value")} />
        {" Value"}
      </label>
      <label>
        <input type="radio" checked={valueOrRange === "range"} onChange={()=> setValueOrRange("range")} />
        {" Range"}
      </label>
    </div>
    {valueOrRange === "value" ? (
      <ValueInput value={value} onChange={(onChange)} />
    ) : (
      <RangeInput value={value} onChange={onChange} />
    )}
  </>
}

function ValueInput({ value: countValue, onChange }: InputProps<Count>){
  const [invalidValue, setInvalidValue] = useState("");
  const [error, setError] = useState<null | string>(null);
  useEffect(()=>{
    if(Array.isArray(countValue)) onChange(valueToNumber(countValue));
  },[countValue])

  const value = valueToNumber(countValue);

  return <>
    <div>
      <input
        type="text"
        value={error !== null ? invalidValue : Array.isArray(value) ? value[0] : value}
        onChange={(e)=>{
          try {
            setError(null);
            const validValue = validateNumberOrStar(e.target.value);
            validateRange(validValue)
            onChange(validValue);
          }catch(error){
            setError((error as Error).message);
            setInvalidValue(e.target.value);
          }
        }}
      />
    </div>
    {error !== null && <InputError>{error}</InputError>}
  </>
}

function RangeInput({ value: countValue, onChange }: InputProps<Count>){
  const [minInvalidValue, setMinInvalidValue] = useState("");
  const [minError, setMinError] = useState<null | string>(null);
  const [maxInvalidValue, setMaxInvalidValue] = useState("");
  const [maxError, setMaxError] = useState<null | string>(null);

  useEffect(()=>{
    if(!Array.isArray(countValue)) onChange(valueToArray(countValue))
  },[countValue])

  const value = valueToArray(countValue);

  return <>
    <div>
      <div>
        <span>Min: </span>
        <input
          type="text"
          value={minError !== null ? minInvalidValue : value[0]}
          onChange={(e)=>{
            try {
              setMinError(null);
              const newValues: [number, number | "*"] = [validateCount(e.target.value), value[1]];
              validateRange(newValues);
              onChange(newValues);
            }catch(error){
              setMinError((error as Error).message);
              setMinInvalidValue(e.target.value);
            }
          }}
        />
      </div>
      {minError !== null && <InputError>{minError}</InputError>}
      <div>
        <span>Max: </span>
        <input
          type="text"
          value={maxError !== null ? maxInvalidValue : value[1]}
          onChange={(e)=>{
            try {
              setMaxError(null);
              const newValues: [number, number | "*"] = [value[0], validateNumberOrStar(e.target.value)];
              validateRange(newValues);
              onChange(newValues);
            }catch(error){
              console.error(error);
              setMaxError((error as Error).message);
              setMaxInvalidValue(e.target.value);
            }
          }}
        />
      </div>
      {maxError !== null && <InputError>{maxError}</InputError>}
    </div>
  </>

}

function valueToNumber(value: Count): number | "*" {
  if(!Array.isArray(value)) return value;
  if(value[0] === 0) return value[1]
  return value[0];
}

function valueToArray(value: Count): [number, number | "*"]{
  if(Array.isArray(value)) return value;
  if(value === "*" ) return [0, "*"];
  return [value, value + 1];
}

function validateCount(value: string): number {
  const num = Number.parseInt(value);
  if(Number.isNaN(num)){
    throw new Error("Expecting a number");
  }
  if(Math.round(num) !== num){
    throw new Error("Expecting a whole number");
  }
  return num;
}

function validateNumberOrStar(value: string): number | "*"{
  if(value === "*") return value;
  const num = Number.parseInt(value);
  if(Number.isNaN(num)){
    throw new Error("Expecting a number or *");
  }
  if(Math.round(num) !== num){
    throw new Error("Expecting a whole number or *");
  }
  return num;
}
