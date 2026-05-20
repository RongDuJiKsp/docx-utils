import fs from 'fs/promises'
import mammoth from 'mammoth'
import * as cheerio from 'cheerio'

export type DocxSection = {
	id: string
	title: string
	level: number
	text: string
}

export type DocxOutline = {
	sections: DocxSection[]
	fullText: string
}

export async function extractRawText(filePath: string): Promise<string> {
	const buffer = await fs.readFile(filePath)
	const result = await mammoth.extractRawText({ buffer })
	return result.value
}

type OutlineBuildResult = {
	sections: DocxSection[]
	anchorCount: number
}

const BLOCK_TAGS = new Set(['p', 'div', 'blockquote', 'pre', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th'])

const ANCHOR_HEADING_RE = /^(\d+(?:\.\d+)+)\s+(.+)$/

function normalizeTitle(text: string): string {
	return text.replace(/\s+/g, ' ').trim()
}

function normalizeSectionText(text: string): string {
	return text
		.replace(/\r/g, '')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n[ \t]+/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.replace(/[ \t]{2,}/g, ' ')
		.trim()
}

function parseAnchorHeading(text: string): { level: number; title: string } | null {
	const normalized = normalizeTitle(text)
	const match = ANCHOR_HEADING_RE.exec(normalized)
	if (!match) {
		return null
	}
  const [,rawNumbering, rawTitle] = match
  	if (!rawNumbering || !rawTitle) {
		return null
	}
	const numbering = rawNumbering
	const title = rawTitle.trim()
	const level = numbering.split('.').length
	return { level, title: title || '无标题' }
}

function buildOutlineFromHtml(html: string): OutlineBuildResult {
	const $ = cheerio.load(html || '')
	const root = $('body').length > 0 ? $('body') : $.root()

	const sections: DocxSection[] = []
	let anchorCount = 0

	let current: { id: string; title: string; level: number; parts: string[] } | null = null

	const flushSection = () => {
		if (!current) {
			return
		}

		const text = normalizeSectionText(current.parts.join(''))
		sections.push({
			id: current.id,
			title: current.title,
			level: current.level,
			text,
		})
		current = null
	}

	const ensureSection = () => {
		if (current) {
			return
		}
		current = {
			id: `section-${sections.length + 1}`,
			title: '无标题',
			level: 1,
			parts: [],
		}
	}

	const appendText = (value: string) => {
		const text = value.replace(/\s+/g, ' ')
		if (text.trim() === '') {
			return
		}
		ensureSection()
		current?.parts.push(text)
	}

	const appendBreak = () => {
		if (!current) {
			return
		}
		current.parts.push('\n')
	}

	const walk = (node: cheerio.AnyNode) => {
		if (node.type === 'tag') {
			const tagName = node.tagName?.toLowerCase()

			if (tagName === 'a') {
				const heading = parseAnchorHeading($(node).text())
				if (heading) {
					anchorCount += 1
					flushSection()
					current = {
						id: `section-${sections.length + 1}`,
						title: heading.title,
						level: heading.level,
						parts: [],
					}
					return
				}
			}

			if (node.children) {
				for (const child of node.children) {
					walk(child)
				}
			}

			if (tagName && BLOCK_TAGS.has(tagName)) {
				appendBreak()
			}
			return
		}

		if (node.type === 'text') {
			appendText(node.data ?? '')
		}
	}

	root.contents().each((index: number, node: cheerio.AnyNode) => {
		void index
		walk(node)
	})

	flushSection()

	return { sections, anchorCount }
}

export async function extractDocxOutline(filePath: string): Promise<DocxOutline> {
	const buffer = await fs.readFile(filePath)
	const [rawResult, htmlResult] = await Promise.all([mammoth.extractRawText({ buffer }), mammoth.convertToHtml({ buffer })])

	const fullText = rawResult.value
	const { sections, anchorCount } = buildOutlineFromHtml(htmlResult.value ?? '')

	if (anchorCount === 0) {
		return {
			sections: [
				{
					id: 'section-1',
					title: '全文',
					level: 1,
					text: fullText,
				},
			],
			fullText,
		}
	}

	return {
		sections,
		fullText,
	}
}
