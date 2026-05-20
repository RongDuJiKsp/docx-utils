import type { AiProvider, ProviderId } from './types'
import { GlobalOpenAiProvider } from './openai'

const PROVIDERS: Record<ProviderId, AiProvider> = {
	openai: GlobalOpenAiProvider,
}

export function getAiProvider(providerId: ProviderId): AiProvider {
	const provider = PROVIDERS[providerId]
	if (!provider) {
		throw new Error(`Unsupported provider: ${providerId}`)
	}

	return provider
}
