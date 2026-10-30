import { useState } from "react";

export function ValidatedTextInput({ title, value, onChange, validate }: {
  title: string,
  value: string,
  onChange: (value: string) => void,
  validate: (value: string) => void,
}){
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <label>
        {title} <input
          type="text"
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            onChange(next);
            try {
              validate(next);
              setError(null);
            } catch(err){
              setError(err instanceof Error ? err.message : String(err));
            }
          }}
        />
      </label>
      {error ? <div style={{ color: "red" }}>{error}</div> : null}
    </div>
  );
}
