import { useEffect, useState, CSSProperties } from "react";
import { InputProps } from "../../utils/react";
import { ToolTipSpan, SPAN_STYLE } from "../ToolTip";

export function ValidatingTextInput({ value, onChange, validate, style }: (
  & InputProps<string>
  & { validate: (v: string)=>unknown }
  & { style?: CSSProperties }
)){
  const [unkownValue, setUnkownValue] = useState(value);
  const [error, setError] = useState<null | string>(null);
  useEffect(()=>{
    setUnkownValue(value);
  },[value])

  if(!error){
    return (
      <span style={{ ...SPAN_STYLE, ...style }} >
        <input
          style={{ flexGrow: 1 }}
          type="text"
          value={unkownValue}
          onChange={(e)=>{
            try {
              setError(null);
              validate(e.target.value);
              onChange(e.target.value);
            }catch(e){
              setError((e as Error).message);
              setUnkownValue(value);
            }
          }}
        />
      </span>
    );
  }

  return (
    <ToolTipSpan tip={error} style={style} >
    <input
      style={{ border: "1px solid #F00", flexGrow: 1 }}
      type="text"
      value={unkownValue}
      onChange={(e)=>{
        try {
          setError(null);
          validate(e.target.value);
          onChange(e.target.value);
        }catch(e){
          setError((e as Error).message);
          setUnkownValue(value);
        }
      }}
    />
    </ToolTipSpan>
  );
}
