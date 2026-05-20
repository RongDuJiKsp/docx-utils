import { ChatOpenAI } from '@langchain/openai'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { BaseMessage } from '@langchain/core/messages'
import type { Agent, AiProvider, ModelConfig, ModelConfigParam } from '../types'
import { parseNumber, requireEnv } from '../../env'

export class DeepseekProvider implements AiProvider {
	readonly id = 'deepseek'

	loadConfigFromEnv(overrides: Partial<ModelConfigParam> = {}): ModelConfig {
		const model = requireEnv(process.env.DEEPSEEK_MODEL, 'DEEPSEEK_MODEL')
		const temperature = overrides.temperature ?? parseNumber(process.env.AI_TEMPERATURE, undefined, 'AI_TEMPERATURE')
		const apiKey = requireEnv(process.env.DEEPSEEK_API_KEY, 'DEEPSEEK_API_KEY')
		const baseUrl = requireEnv(process.env.DEEPSEEK_BASE_URL?.trim(), 'DEEPSEEK_BASE_URL')

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
		const streamingResponse = await agent.stream({
			messages: beforeMessages,
		})

		return async function* () {
			for await (const chunk of streamingResponse as AsyncIterable<{
				model_request?: { messages?: BaseMessage[] }
				tools?: { messages?: BaseMessage[] }
			}>) {
				yield chunk.model_request?.messages || chunk.tools?.messages || []
			}
		}
	}
}

export const GlobalDeepseekProvider = new DeepseekProvider()
