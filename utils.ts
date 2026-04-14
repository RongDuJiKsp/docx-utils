import fs from "fs/promises";
import mammoth from "mammoth";

export async function extractRawText(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export function parseNonNegativeInteger(rawValue: undefined, argName: string): undefined;
export function parseNonNegativeInteger(rawValue: string, argName: string): number;
export function parseNonNegativeInteger(rawValue: string | undefined, argName: string): number | undefined;
export function parseNonNegativeInteger(rawValue: string | undefined, argName: string): number | undefined {
  if (rawValue === undefined) {
    return undefined;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${argName} 必须是大于等于 0 的整数，当前值: ${rawValue}`);
  }

  return value;
}

export function resolveSliceRange(total: number, arg1?: number, arg2?: number): [number, number] {
  if (arg1 === undefined) {
    return [0, total];
  }

  const start = Math.min(arg1, total);

  if (arg2 === undefined) {
    return [start, Math.min(total, start + 20)];
  }

  if (arg2 < arg1) {
    throw new Error(`arg2 必须大于等于 arg1，当前 arg1=${arg1}, arg2=${arg2}`);
  }

  return [start, Math.min(arg2, total)];
}
