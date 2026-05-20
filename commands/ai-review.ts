import fs from 'fs/promises'
import { z } from 'zod'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { DynamicStructuredTool, DynamicTool } from '@langchain/core/tools'
import { AgentExecutor, createOpenAIToolsAgent } from 'langchain/agents'
import { extractDocxOutline, type DocxOutline } from '../utils/docx'
import { loadAiReviewConfig } from '../utils/env'
import { createChatModel } from '../utils/ai/provider'

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

function toSingleLine(value: string): string {
	return value.replace(/\s+/g, ' ').trim()
}

function formatStreamEvent(event: unknown): string {
	if (event === null || event === undefined) {
		return ''
	}

	if (typeof event === 'string') {
		return toSingleLine(event)
	}

	if (typeof event !== 'object') {
		return String(event)
	}

	const record = event as Record<string, unknown>
	const parts: string[] = []

	if ('action' in record && record.action && typeof record.action === 'object') {
		const action = record.action as Record<string, unknown>
		const tool = typeof action.tool === 'string' ? action.tool : 'action'
		const input = action.toolInput !== undefined ? toSingleLine(JSON.stringify(action.toolInput)) : ''
		const line = input ? `调用 ${tool}: ${input}` : `调用 ${tool}`
		parts.push(line)
	}

	if ('observation' in record) {
		const observation = toSingleLine(JSON.stringify(record.observation ?? ''))
		if (observation) {
			parts.push(`观察: ${observation}`)
		}
	}

	if ('returnValues' in record) {
		const output = toSingleLine(JSON.stringify(record.returnValues ?? ''))
		if (output) {
			parts.push(`完成: ${output}`)
		}
	}

	if (parts.length > 0) {
		return parts.join(' | ')
	}

	return toSingleLine(JSON.stringify(record))
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

function createOutlineTools(outline: DocxOutline) {
	const sections = outline.sections
	const sectionMap = new Map(sections.map((section) => [section.id, section]))

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
					title: section.title,
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
			const section = sectionMap.get(sectionId)
			if (!section) {
				throw new Error(`未找到章节: ${sectionId}`)
			}

			return JSON.stringify({
				id: section.id,
				title: section.title,
				level: section.level,
				text: section.text,
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
	const outline = await extractDocxOutline(fileName)
	const issues: AiReviewIssue[] = []

	const config = loadAiReviewConfig({
		maxIterations: options.maxIterations,
	})

	const { outlineTool, sectionTool } = createOutlineTools(outline)
	const rulesTool = createRulesTool(options.rules)
	const issueTool = createIssueTool(issues)

	const model = createChatModel(config)

	const prompt = ChatPromptTemplate.fromMessages([
		['system', buildSystemPrompt()],
		['human', '{input}'],
	])

	const tools = [rulesTool, outlineTool, sectionTool, issueTool]

	const agent = await createOpenAIToolsAgent({
		llm: model,
		tools,
		prompt,
	})

	const executor = new AgentExecutor({
		agent,
		tools,
		maxIterations: config.maxIterations,
	})

	console.log('开始 AI 章节审查...')

	const stream = await executor.stream({
		input: [`目标文件: ${fileName}`, `规则文件: ${options.rules}`, `章节数: ${outline.sections.length}`, '请按工具流程执行审查。'].join('\n'),
	})

	for await (const chunk of stream) {
		const line = formatStreamEvent(chunk)
		if (line) {
			console.log(line)
		}
	}

	console.log(formatIssues(issues))
}
