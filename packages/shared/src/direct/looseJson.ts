/** Readers that tolerate Xtream panels mixing strings, numbers, nulls and empty arrays for one field. Mirrors backend LooseJson. */
export type Json = unknown;

export const isObject = (value: Json): value is Record<string, Json> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const prop = (value: Json, name: string): Json => (isObject(value) ? value[name] : undefined);

export function str(value: Json, name: string): string | null {
  const field = prop(value, name);
  const text =
    typeof field === 'string' ? field : typeof field === 'number' ? String(field) : typeof field === 'boolean' ? (field ? '1' : '0') : null;
  const trimmed = text?.trim();
  return trimmed ? trimmed : null;
}

export function num(value: Json, name: string): number | null {
  const text = str(value, name);
  if (text === null) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function int(value: Json, name: string): number | null {
  const number = num(value, name);
  return number === null ? null : Math.trunc(number);
}

export function bool(value: Json, name: string): boolean {
  const text = str(value, name);
  return text === '1' || text?.toLowerCase() === 'true';
}

/** Unix seconds → ISO string; null for missing, zero or non-integer values. */
export function unixTime(value: Json, name: string): string | null {
  const text = str(value, name);
  if (text === null || !/^\d+$/.test(text)) return null;
  const seconds = Number(text);
  return seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

/** A string array, a single string, or nothing. Drops blanks. */
export function strList(value: Json, name: string): string[] {
  const field = prop(value, name);
  if (Array.isArray(field))
    return field.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim());
  return typeof field === 'string' && field.trim() ? [field.trim()] : [];
}

export const items = (value: Json): Json[] => (Array.isArray(value) ? value : []);
