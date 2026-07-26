
export type InputProps<V> = { value: V, onChange: (v: V)=>unknown };

export type StateInputProps<V> = { value: V, onChange: (v: V | ((prev: V) => V)) => unknown };

export type ListItemProps<V> = { index: number, items: Array<V>, onDelete: ()=>unknown };

export type ValidInputProps<V> = InputProps<V> & { onError?: (error: string)=>unknown };

import { useMemo } from "react";
export function useValidator<T>(value: T, validate: (v: T)=>unknown){
  return useMemo(()=>{
    try {
      validate(value);
      return null
    }catch(e){
      return (e as Error).message;
    }
  },[value, validate]);
}
