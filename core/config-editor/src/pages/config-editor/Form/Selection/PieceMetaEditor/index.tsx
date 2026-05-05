import { useState } from "react";
import type { SelectionPieceMeta, JSONShallowObject } from "@roster-lock/types";
import type { RosterLockPiece } from "@roster-lock/types";
import type { InputProps } from "../../../../../utils/react/input";

type SimpleSchemaType = "boolean" | "number" | "string" | "boolean[]" | "number[]" | "string[]";
type PieceMeta = SelectionPieceMeta<JSONShallowObject>;

const SCHEMA_TYPES: SimpleSchemaType[] = [
  "boolean", "number", "string", "boolean[]", "number[]", "string[]",
];

function defaultValue(type: SimpleSchemaType): JSONShallowObject[string] {
  if (type === "boolean") return false;
  if (type === "number") return 0;
  if (type === "string") return "";
  if (type === "boolean[]") return [];
  if (type === "number[]") return [];
  return [];
}

function parseArrayValue(raw: string, type: "boolean[]" | "number[]" | "string[]"): JSONShallowObject[string] {
  const parts = raw.split(",").map(s => s.trim()).filter(Boolean);
  if (type === "number[]") return parts.map(Number);
  if (type === "boolean[]") return parts.map(s => s === "true");
  return parts;
}

function displayValue(v: JSONShallowObject[string] | undefined, type: SimpleSchemaType): string {
  if (v === undefined || v === null) return "";
  if (Array.isArray(v)) return (v as unknown[]).join(", ");
  return String(v);
}

type MetaValueInputProps = {
  type: SimpleSchemaType;
  value: JSONShallowObject[string] | undefined;
  placeholder?: string;
  onChange: (v: JSONShallowObject[string]) => void;
  onClear?: () => void;
};

function MetaValueInput({ type, value, placeholder, onChange, onClear }: MetaValueInputProps) {
  if (type === "boolean") {
    return (
      <label style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
        <input
          type="checkbox"
          checked={typeof value === "boolean" ? value : false}
          onChange={e => onChange(e.target.checked)}
        />
        {onClear && <button type="button" onClick={onClear} style={{ fontSize: "0.7em" }}>↩</button>}
      </label>
    );
  }

  if (type === "number") {
    return (
      <span style={{ display: "flex", gap: "0.25rem" }}>
        <input
          type="number"
          style={{ width: "6rem" }}
          value={typeof value === "number" ? value : ""}
          placeholder={placeholder}
          onChange={e => onChange(Number(e.target.value))}
        />
        {onClear && <button type="button" onClick={onClear} style={{ fontSize: "0.7em" }}>↩</button>}
      </span>
    );
  }

  if (type === "string") {
    return (
      <span style={{ display: "flex", gap: "0.25rem" }}>
        <input
          type="text"
          style={{ width: "8rem" }}
          value={typeof value === "string" ? value : ""}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
        />
        {onClear && <button type="button" onClick={onClear} style={{ fontSize: "0.7em" }}>↩</button>}
      </span>
    );
  }

  // Array types
  return (
    <span style={{ display: "flex", gap: "0.25rem" }}>
      <input
        type="text"
        style={{ width: "10rem" }}
        value={displayValue(value, type)}
        placeholder={placeholder ?? "comma-separated"}
        onChange={e => onChange(parseArrayValue(e.target.value, type as "boolean[]" | "number[]" | "string[]"))}
      />
      {onClear && <button type="button" onClick={onClear} style={{ fontSize: "0.7em" }}>↩</button>}
    </span>
  );
}

type Props = InputProps<PieceMeta> & {
  pieces: Array<RosterLockPiece>;
};

export function PieceMetaEditor({ value, onChange, pieces }: Props) {
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<SimpleSchemaType>("string");
  const [addError, setAddError] = useState<string | null>(null);

  const schema = value.schema;
  const defaultMeta = value.defaultMeta;
  const pieceMeta = value.pieceMeta;

  const fields = Object.keys(schema);

  function update(patch: Partial<PieceMeta>) {
    onChange({
      ...value,
      ...patch,
    });
  }

  function addField() {
    const name = newFieldName.trim();
    if (!name) { setAddError("Field name is required"); return; }
    if (schema[name]) { setAddError("Field already exists"); return; }
    setAddError(null);
    update({
      schema: { ...schema, [name]: newFieldType },
      defaultMeta: { ...defaultMeta, [name]: defaultValue(newFieldType) },
    });
    setNewFieldName("");
  }

  function removeField(name: string) {
    const { [name]: _s, ...newSchema } = schema;
    const { [name]: _d, ...newDefault } = defaultMeta;
    const newPieceMeta: typeof pieceMeta = {};
    for (const [pieceId, overrides] of Object.entries(pieceMeta)) {
      const { [name]: _p, ...rest } = overrides as Record<string, JSONShallowObject[string]>;
      newPieceMeta[pieceId] = rest;
    }
    update({ schema: newSchema, defaultMeta: newDefault, pieceMeta: newPieceMeta });
  }

  function setDefaultField(name: string, v: JSONShallowObject[string]) {
    update({ defaultMeta: { ...defaultMeta, [name]: v } });
  }

  function setPieceField(pieceId: string, name: string, v: JSONShallowObject[string] | undefined) {
    const current = pieceMeta[pieceId] ?? {};
    if (v === undefined) {
      const { [name]: _, ...rest } = current as Record<string, JSONShallowObject[string]>;
      update({ pieceMeta: { ...pieceMeta, [pieceId]: rest } });
    } else {
      update({ pieceMeta: { ...pieceMeta, [pieceId]: { ...current, [name]: v } } });
    }
  }

  return (
    <>
      {/* Schema */}
      <div className="section">
        <h4>Schema Fields</h4>
        {fields.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Type</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {fields.map(name => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>
                    <select
                      value={schema[name]}
                      onChange={e => update({ schema: { ...schema, [name]: e.target.value as SimpleSchemaType } })}
                    >
                      {SCHEMA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td>
                    <button type="button" onClick={() => removeField(name)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form
          onSubmit={e => { e.preventDefault(); addField(); }}
          style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.5rem" }}
        >
          <input
            type="text"
            placeholder="Field name..."
            value={newFieldName}
            onChange={e => { setNewFieldName(e.target.value); setAddError(null); }}
          />
          <select
            value={newFieldType}
            onChange={e => setNewFieldType(e.target.value as SimpleSchemaType)}
          >
            {SCHEMA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button type="submit">Add Field</button>
        </form>
        {addError && <div className="error">{addError}</div>}
      </div>

      {/* Default values */}
      {fields.length > 0 && (
        <div className="section">
          <h4>Default Values</h4>
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Default</th>
              </tr>
            </thead>
            <tbody>
              {fields.map(name => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>
                    <MetaValueInput
                      type={schema[name]}
                      value={defaultMeta[name]}
                      onChange={v => setDefaultField(name, v)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Per-piece overrides */}
      {fields.length > 0 && pieces.length > 0 && (
        <div className="section">
          <h4>Per-Piece Overrides</h4>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Piece ID</th>
                  {fields.map(f => <th key={f}>{f}</th>)}
                </tr>
              </thead>
              <tbody>
                {pieces.map(piece => (
                  <tr key={piece.id}>
                    <td style={{ fontFamily: "monospace" }}>{piece.id}</td>
                    {fields.map(name => {
                      const hasOverride = pieceMeta[piece.id] !== undefined &&
                        name in (pieceMeta[piece.id] as object);
                      const overrideVal = (pieceMeta[piece.id] as Record<string, JSONShallowObject[string]> | undefined)?.[name];
                      return (
                        <td key={name}>
                          <MetaValueInput
                            type={schema[name]}
                            value={hasOverride ? overrideVal : defaultMeta[name]}
                            placeholder={hasOverride ? undefined : String(displayValue(defaultMeta[name], schema[name]))}
                            onChange={v => setPieceField(piece.id, name, v)}
                            onClear={hasOverride ? () => setPieceField(piece.id, name, undefined) : undefined}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
