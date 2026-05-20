import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { AiReviewConfig } from '../env'
import { createOpenAIModel } from './openai'

export function createChatModel(config: AiReviewConfig): BaseChatModel {
	switch (config.provider) {
		case 'openai':
			return createOpenAIModel({
				apiKey: config.apiKey,
				baseUrl: config.baseUrl,
				model: config.model,
				temperature: config.temperature,
			})
		default:
			throw new Error(`Unsupported provider: ${config.provider}`)
	}
}
