import { useEffect, useRef, useState, CSSProperties } from "react";
import { InputProps } from "../../utils/react";
import { ToolTipSpan, SPAN_STYLE } from "../ToolTip";

export function AsyncValidatingTextInput({ value, onChange, validate, style }: (
  & InputProps<string>
  & { validate: (v: string) => Promise<unknown> }
  & { style?: CSSProperties }
)) {
  const [unknownValue, setUnknownValue] = useState(value);
  const [error, setError] = useState<null | string>(null);
  const [validating, setValidating] = useState(false);
  const generationRef = useRef(0);

  useEffect(() => {
    setUnknownValue(value);
  }, [value]);

  const handleChange = async (newValue: string) => {
    const generation = ++generationRef.current;
    setUnknownValue(newValue);
    setError(null);
    setValidating(true);
    try {
      await validate(newValue);
      if (generation !== generationRef.current) return;
      setValidating(false);
      onChange(newValue);
    } catch (e) {
      if (generation !== generationRef.current) return;
      setValidating(false);
      setError((e as Error).message);
      setUnknownValue(value);
    }
  };

  const inputStyle: CSSProperties = {
    flexGrow: 1,
    ...(error ? { border: "1px solid #F00" } : {}),
    ...(validating ? { opacity: 0.6 } : {}),
  };

  const input = (
    <input
      style={inputStyle}
      type="text"
      value={unknownValue}
      disabled={validating}
      onChange={(e) => handleChange(e.target.value)}
    />
  );

  if (error) {
    return <ToolTipSpan tip={error} style={style}>{input}</ToolTipSpan>;
  }

  return <span style={{ ...SPAN_STYLE, ...style }}>{input}</span>;
}
