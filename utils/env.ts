import * as dotenv from 'dotenv'
import path from 'node:path'
import process from 'node:process'

export function ensureEnvLoaded() {
  const cwd = process.cwd()
  dotenv.config({ path: path.join(cwd, '.env') })
  dotenv.config({ path: path.join(cwd, '.env.local'), override: true })
}

export function parseNumber(
  value: string | undefined,
  fallback: number,
  label: string,
): number
export function parseNumber(
  value: string | undefined,
  fallback: undefined,
  label: string,
): number | undefined
export function parseNumber(
  value: string | undefined,
  fallback: number | undefined,
  label: string,
): number | undefined {
  if (value === undefined || value.trim() === '') {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} 必须是数值，当前值: ${value}`)
  }

  return parsed
}

export function requireEnv(value: string | undefined, label: string): string {
  if (!value || value.trim() === '') {
    throw new Error(`${label} 未配置`)
  }

  return value.trim()
}
