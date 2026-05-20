import { ChatOpenAI } from '@langchain/openai'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { BaseMessage } from '@langchain/core/messages'
import type { Agent, AiProvider, ModelConfig } from './types'

export class OpenAiProvider implements AiProvider {
	readonly id = 'openai'

	createModel(config: ModelConfig): BaseChatModel | null {
		return new ChatOpenAI({
			model: config.model,
			apiKey: config.apiKey,
			temperature: config.temperature ?? 0.2,
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
