import type { AiProvider, ProviderId } from './types'
import { GlobalOpenAiProvider } from './providers/openai'
import { GlobalDeepseekProvider } from './providers/deepseek'

const PROVIDERS: Record<ProviderId, AiProvider> = {
	openai: GlobalOpenAiProvider,
	deepseek: GlobalDeepseekProvider,
}

export function getAiProvider(providerId: ProviderId): AiProvider {
	const provider = PROVIDERS[providerId]
	if (!provider) {
		throw new Error(`Unsupported provider: ${providerId}`)
	}

	return provider
}

export function getAiProviderFromEnv(): AiProvider {
	const raw = (process.env.AI_PROVIDER ?? 'openai').toLowerCase()
	return getAiProvider(raw as ProviderId)
}
