import fs from 'fs/promises'
import { z } from 'zod'
import { DynamicStructuredTool, DynamicTool } from '@langchain/core/tools'
import { AIMessage, BaseMessage, HumanMessage, ToolMessage } from '@langchain/core/messages'
import { createAgent } from 'langchain'
import { parseNumber } from '../utils/env'
import { getAiProviderFromEnv } from '../utils/ai/provider'
import { DocxDocument } from '../utils/docx'

export type AiReviewOptions = {
	rules: string
	maxIterations?: number
}

export type AiReviewIssue = {
	sectionId?: string
	sectionTitle?: string
	severity: 'low' | 'medium' | 'high' | 'critical'
	message: string
	evidence?: string
	suggestion?: string
}

function formatIssues(issues: AiReviewIssue[]): string {
	if (issues.length === 0) {
		return '未发现问题。'
	}

	const groups = new Map<string, AiReviewIssue[]>()

	for (const issue of issues) {
		const key = issue.sectionTitle || issue.sectionId || '未指定章节'
		const list = groups.get(key) ?? []
		list.push(issue)
		groups.set(key, list)
	}

	const lines: string[] = [`发现问题数: ${issues.length}`]

	for (const [section, list] of groups) {
		lines.push('')
		lines.push(`[${section}]`)

		for (const issue of list) {
			const parts: string[] = [`(${issue.severity}) ${issue.message}`]
			if (issue.evidence) {
				parts.push(`证据: ${issue.evidence}`)
			}
			if (issue.suggestion) {
				parts.push(`建议: ${issue.suggestion}`)
			}
			lines.push(`- ${parts.join(' | ')}`)
		}
	}

	return lines.join('\n')
}

function formatStreamMessages(messages: BaseMessage[]): unknown[] {
	const lines: unknown[] = []
	const replaceNewlines = (text: string) => text.replaceAll('\\n', '\n')
	const fmtObjectString = (objString: string) => {
		try {
			return JSON.parse(objString)
		} catch {
			return objString
		}
	}
	messages.forEach((msg) => {
		if (ToolMessage.isInstance(msg)) {
			lines.push(`[工具调用] ${msg.name}`)
			if (typeof msg.content === 'string') {
				lines.push(fmtObjectString(msg.content))
			} else {
				lines.push('[Text Blocks]')
			}
		} else if (HumanMessage.isInstance(msg)) {
			lines.push(`[用户] ${replaceNewlines(msg.text)}`)
		} else if (AIMessage.isInstance(msg)) {
			lines.push(`[AI] ${replaceNewlines(msg.text)}`)
		}
	})
	return lines
}

function createRulesTool(rulesPath: string) {
	return new DynamicTool({
		name: 'read_rules',
		description: '读取审查规则（必须首先调用）。',
		func: async () => {
			const content = await fs.readFile(rulesPath, 'utf-8')
			return content
		},
	})
}

function createOutlineTools(document: DocxDocument) {
	const sections = document.sessions

	const sectionSchema = z.object({
		sectionId: z.string().describe('章节 id'),
	})
	type SectionInput = z.infer<typeof sectionSchema>

	const outlineTool = new DynamicTool({
		name: 'get_outline',
		description: '获取文档大纲列表（id, title, level）。',
		func: async () => {
			return JSON.stringify({
				totalSections: sections.length,
				sections: sections.map((section) => ({
					id: section.id,
					title: section.toTitle(),
					level: section.level,
				})),
			})
		},
	})

	const sectionTool = new DynamicStructuredTool({
		name: 'get_section',
		description: '根据章节 id 获取正文内容。',
		schema: sectionSchema,
		func: async (input: SectionInput) => {
			const { sectionId } = input
			const section = document.findSessionById(sectionId)
			if (!section) {
				throw new Error(`未找到章节: ${sectionId}`)
			}
			const paragraph = document.findParagraphById(sectionId)

			return JSON.stringify({
				id: section.id,
				title: section.toTitle(),
				level: section.level,
				text: paragraph ? paragraph.paragraphs.join('\n') : '',
			})
		},
	})

	return { outlineTool, sectionTool }
}

function createIssueTool(issues: AiReviewIssue[]) {
	const issueSchema = z.object({
		sectionId: z.string().optional().describe('章节 id'),
		sectionTitle: z.string().optional().describe('章节标题'),
		severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
		message: z.string().describe('问题描述'),
		evidence: z.string().optional().describe('证据或引用'),
		suggestion: z.string().optional().describe('建议修复方式'),
	})
	type IssueInput = z.infer<typeof issueSchema>

	return new DynamicStructuredTool({
		name: 'record_issue',
		description: '记录一个发现的问题。',
		schema: issueSchema,
		func: async (input: IssueInput) => {
			issues.push({
				sectionId: input.sectionId,
				sectionTitle: input.sectionTitle,
				severity: input.severity,
				message: input.message,
				evidence: input.evidence,
				suggestion: input.suggestion,
			})
			return 'recorded'
		},
	})
}

function buildSystemPrompt() {
	return [
		'你是严格的文档审查助手，专注于检查章节内容是否符合规则。',
		'必须按以下顺序执行:',
		'1) 首先调用 read_rules 工具读取规则。',
		'2) 调用 get_outline 获取大纲并规划审查顺序。',
		'3) 逐章调用 get_section 获取正文并审查。',
		'4) 每发现一个问题，立即调用 record_issue 记录，不要在最终回复中列出问题。',
		'5) 完成全部章节后，仅输出一句简短的完成确认。',
	].join('\n')
}

export async function aiReview(fileName: string, options: AiReviewOptions) {
	console.log('开始解析Docx文件...')
	const document = await DocxDocument.load(fileName)
	console.log(`文档解析完成，发现 ${document.sessions.length} 个章节。`)
	for (const session of document.sessions) {
		console.log(`章节: ${session.id}, 标题: ${session.toTitle()}, 层级: ${session.level}`)
	}
	const issues: AiReviewIssue[] = []
	const maxIterations = Math.max(1, options.maxIterations ?? parseNumber(process.env.AI_REVIEW_MAX_ITERATIONS, 40, 'AI_REVIEW_MAX_ITERATIONS'))

	const { outlineTool, sectionTool } = createOutlineTools(document)
	const rulesTool = createRulesTool(options.rules)
	const issueTool = createIssueTool(issues)

	const provider = getAiProviderFromEnv()
	const modelConfig = provider.loadConfigFromEnv()
	const model = provider.createModel(modelConfig)

	if (!model) {
		throw new Error(`模型创建失败: ${provider.id}`)
	}

	const tools = [rulesTool, outlineTool, sectionTool, issueTool]

	const agent = createAgent({
		model,
		systemPrompt: buildSystemPrompt(),
		tools,
	}).withConfig({ recursionLimit: maxIterations })

	console.log('开始 AI 章节审查...')

	const beforeMessages = [
		new HumanMessage(
			[`目标文件: ${fileName}`, `规则文件: ${options.rules}`, `章节数: ${document.sessions.length}`, '请按工具流程执行审查。'].join('\n')
		),
	]

	const iteratorFactory = await provider.streamingInvokeIterator(agent, beforeMessages)
	const iterator = iteratorFactory()

	for await (const messages of iterator) {
		console.log('Recv Messages:')
		formatStreamMessages(messages).forEach((line) => console.log(line))
	}
	console.log('审查完成，发现问题数: ' + issues.length)
	console.log(formatIssues(issues))
}
