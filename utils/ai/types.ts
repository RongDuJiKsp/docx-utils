import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { BaseMessage } from '@langchain/core/messages'

import { createAgent } from 'langchain'
export type Agent = ReturnType<typeof createAgent>
export type ModelConfigBase = {
	apiKey: string
	baseUrl?: string
	model: string
}
export type ModelConfigParam = {
	temperature: number
}
export type ModelConfig = ModelConfigBase & Partial<ModelConfigParam>

export type ProviderId = 'openai'

export type ModelFactory = (config: ModelConfig) => BaseChatModel

export interface AiProvider {
	readonly id: ProviderId
	createModel(config: ModelConfig): BaseChatModel|null
	streamingInvokeIterator(agent: Agent, beforeMessages: BaseMessage[]): Promise<() => AsyncGenerator<BaseMessage[], void>>
}
