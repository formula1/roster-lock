
export type JSON_Primitive = string | number | boolean | null;
export type JSON_Array = Array<JSON_Primitive | JSON_Array | JSON_Object>;
export type JSON_Object = { [key: string]: JSON_Primitive | JSON_Array | JSON_Object | undefined };
export type JSON_Unknown = JSON_Primitive | JSON_Array | JSON_Object;

export function cloneJSON<T extends JSON_Unknown>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function compareJSON(a: JSON_Unknown, b: JSON_Unknown): boolean {
  return canonicalJSONStringify(a) === canonicalJSONStringify(b);
}

// Stringifies JSON in a predictable way for signing
export function canonicalJSONStringify(value: any): string {
  // Early exit if value is not an object
  if(typeof value !== 'object') return JSON.stringify(value);
  // Early exit if value is null
  if(value === null) return JSON.stringify(value);

  if (Array.isArray(value)) {
    // Arrays: preserve order of elements
    const elems = value.map(v => canonicalJSONStringify(v)).join(',');
    return `[${elems}]`;
  }

  // Objects: sort keys
  const keys = Object.keys(value).sort();
  const props = keys.map(key => {
    const k = JSON.stringify(key);
    const v = canonicalJSONStringify(value[key]);
    return `${k}:${v}`;
  }).join(',');
  return `{${props}}`;
}

export function isJSONObject(value: any): value is JSON_Object {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
