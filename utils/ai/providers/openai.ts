import { ChatOpenAI } from '@langchain/openai'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { BaseMessage } from '@langchain/core/messages'
import type { Agent, AiProvider, ModelConfig, ModelConfigParam } from '../types'
import { parseNumber, requireEnv } from '../../env'

export class OpenAiProvider implements AiProvider {
	readonly id = 'openai'

	loadConfigFromEnv(overrides: Partial<ModelConfigParam> = {}): ModelConfig {
		const model = requireEnv(process.env.OPENAI_MODEL, 'OPENAI_MODEL')
		const temperature = overrides.temperature ?? parseNumber(process.env.AI_TEMPERATURE, undefined, 'AI_TEMPERATURE')
		const apiKey = requireEnv(process.env.OPENAI_API_KEY, 'OPENAI_API_KEY')
		const baseUrl = requireEnv(process.env.OPENAI_BASE_URL?.trim(), 'OPENAI_BASE_URL')

		return {
			apiKey,
			baseUrl,
			model,
			temperature,
		}
	}

	createModel(config: ModelConfig): BaseChatModel | null {
		return new ChatOpenAI({
			model: config.model,
			apiKey: config.apiKey,
			temperature: config.temperature,
			configuration: config.baseUrl ? { baseURL: config.baseUrl } : undefined,
		})
	}

	async streamingInvokeIterator(agent: Agent, beforeMessages: BaseMessage[]) {
		const stream = await agent.stream(
			{ messages: beforeMessages },
			{ streamMode: 'values' },
		)

		return async function* () {
			for await (const chunk of stream as AsyncIterable<{ messages?: BaseMessage[] }>) {
				const messages = chunk.messages
				if (Array.isArray(messages)) {
					yield messages
				}
			}
		}
	}
}

export const GlobalOpenAiProvider = new OpenAiProvider()
