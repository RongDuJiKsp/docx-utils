import { ChatOpenAI } from '@langchain/openai'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { ModelConfig } from './types'

export function createOpenAIModel(config: ModelConfig): BaseChatModel {
	return new ChatOpenAI({
		model: config.model,
		apiKey: config.apiKey,
		temperature: config.temperature,
		configuration: config.baseUrl ? { baseURL: config.baseUrl } : undefined,
	})
}
