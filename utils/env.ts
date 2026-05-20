import * as dotenv from 'dotenv'
import path from 'path'

export type AiProvider = 'openai'

export type AiReviewConfig = {
	provider: AiProvider
	model: string
	apiKey: string
	baseUrl?: string
	temperature: number
	maxIterations: number
}

export type AiReviewOverrides = Partial<Pick<AiReviewConfig, 'model' | 'temperature' | 'maxIterations'>>

export function loadEnvFiles() {
	const cwd = process.cwd()
	dotenv.config({ path: path.join(cwd, '.env') })
	dotenv.config({ path: path.join(cwd, '.env.local'), override: true })
}

function parseNumber(value: string | undefined, fallback: number, label: string): number {
	if (value === undefined || value.trim() === '') {
		return fallback
	}

	const parsed = Number(value)
	if (!Number.isFinite(parsed)) {
		throw new Error(`${label} 必须是数值，当前值: ${value}`)
	}

	return parsed
}

function requireEnv(value: string | undefined, label: string): string {
	if (!value || value.trim() === '') {
		throw new Error(`${label} 未配置`)
	}

	return value.trim()
}

export function loadAiReviewConfig(overrides: AiReviewOverrides = {}): AiReviewConfig {
	loadEnvFiles()

	const providerRaw = (process.env.AI_PROVIDER ?? 'openai').toLowerCase()
	if (providerRaw !== 'openai') {
		throw new Error(`暂不支持的 provider: ${providerRaw}`)
	}

	const model = overrides.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
	const temperature = overrides.temperature ?? parseNumber(process.env.AI_TEMPERATURE, 0.2, 'AI_TEMPERATURE')
	const maxIterations = overrides.maxIterations ?? Math.max(1, parseNumber(process.env.AI_REVIEW_MAX_ITERATIONS, 40, 'AI_REVIEW_MAX_ITERATIONS'))

	const apiKey = requireEnv(process.env.OPENAI_API_KEY, 'OPENAI_API_KEY')
	const baseUrl = process.env.OPENAI_BASE_URL?.trim() || undefined

	return {
		provider: 'openai',
		model,
		apiKey,
		baseUrl,
		temperature,
		maxIterations,
	}
}
