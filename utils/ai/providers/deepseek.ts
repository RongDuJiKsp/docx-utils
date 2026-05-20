import { ChatOpenAI } from '@langchain/openai'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { BaseMessage } from '@langchain/core/messages'
import type { Agent, AiProvider, ModelConfig } from '../types'

export class DeepseekProvider implements AiProvider {
	readonly id = 'deepseek'

	createModel(config: ModelConfig): BaseChatModel | null {
		return new ChatOpenAI({
			model: config.model,
			apiKey: config.apiKey,
			temperature: config.temperature ?? 0.2,
			configuration: config.baseUrl ? { baseURL: config.baseUrl } : undefined,
		})
	}

	async streamingInvokeIterator(agent: Agent, beforeMessages: BaseMessage[]) {
		const streamingResponse = await agent.stream({
			messages: beforeMessages,
		})

		return async function* () {
			for await (const chunk of streamingResponse as AsyncIterable<{ model_request?: { messages?: BaseMessage[] }; tools?: { messages?: BaseMessage[] } }>) {
				yield chunk.model_request?.messages || chunk.tools?.messages || []
			}
		}
	}
}

export const GlobalDeepseekProvider = new DeepseekProvider()
