import fs from 'fs/promises'
import mammoth from 'mammoth'
import type { Cheerio, CheerioAPI } from 'cheerio'
import { load } from 'cheerio'
import type { Element } from 'domhandler'

export async function extractRawText(filePath: string): Promise<string> {
	const buffer = await fs.readFile(filePath)
	const result = await mammoth.extractRawText({ buffer })
	return result.value
}

const ANCHOR_NUMBER_RE = /^\d+(?:\.\d+)+$/
const CHAPTER_NUMBER_RE = /^第(\d+)章$/
const APPEND_NUMBER_RE = /^附录(.+)$/
// 章节标题的选择器，包含常见的标题元素和列表元素
const TOC_NODE_SELECTOR = 'p, h1, h2, h3, h4, h5, h6, li, ui, ol'
// 粗体、斜体、下划线、删除线、上标和下标
const STYLE_NODE_SELECTOR = 'strong, b, em, i, u, sub, sup'

export class DocxSession {
	constructor(
		readonly id: string,
		readonly rawText: string,
		readonly level: number,
		readonly deepLevel: string[],
		readonly title: string
	) {}

	// 将标题文本解析为章节信息，支持四种格式：1）以数字点分隔的多级章节（如 "1.2.3"） 2）以 "第X章" 格式表示的章节 3）以 "附录X" 格式表示的章节 4）如果不符合上述格式，则将整个标题作为一级章节处理。
	static parseTitleToEntry(text: string): Pick<DocxSession, 'level' | 'deepLevel' | 'title'> | null {
		const [first, ...others] = text.split(/\s+/)
		const title = others?.slice(0, -1).join(' ')
		if (!first) {
			return null
		}

		if (CHAPTER_NUMBER_RE.test(first)) {
			return { level: 1, deepLevel: [first], title }
		}

		if (APPEND_NUMBER_RE.test(first)) {
			return { level: 1, deepLevel: [first], title }
		}

		if (ANCHOR_NUMBER_RE.test(first)) {
			const deepLevel = first.split('.')
			return { level: deepLevel.length, deepLevel, title }
		}

		return { level: 1, deepLevel: [first], title: '' }
	}

	private static titleElement(nodeEl: Cheerio<Element>): Cheerio<Element> | null {
		const anchors = nodeEl.find('a')
		if (anchors.length !== 1) {
			return null
		}
		const anchorEl = anchors.first()
		if (anchorEl.children(`:not(${STYLE_NODE_SELECTOR})`).length !== 0) {
			return null
		}
		if(anchorEl.text().trim() === '') {
			return null
		}
		return anchorEl
	}

	private static titleParagraphElement(nodeEl: Cheerio<Element>): Cheerio<Element> | null {
		if (nodeEl.children(`:not(${STYLE_NODE_SELECTOR})`).length !== 0) {
			return null
		}
		return nodeEl
	}

	// 从段落元素中提取标题文本，要求该段落下有且仅有一个子元素为 a 标签，且 a 标签下没有子元素，即为纯文本
	static getTitleFromParagraphElement(nodeEl: Cheerio<Element>): string | null {
		const anchorEl = this.titleElement(nodeEl)
		if (!anchorEl) {
			return null
		}
		return anchorEl.text().trim() || null
	}

	// 判断给定元素是否为实例对应的标题元素 要求是段落元素，且下没有子元素
	is(nodeEl: Cheerio<Element>): boolean {
		const graphEl = DocxSession.titleParagraphElement(nodeEl)
		if (!graphEl) {
			return false
		}
		const text = graphEl.text().trim()
		return text.slice(0, 100).replaceAll(' ', '').startsWith(this.toTitle().replaceAll(' ', ''))
	}

	toTitle(): string {
		return `${this.deepLevel.join('.')} ${this.title}`
	}
}

export class DocxParagraph {
	constructor(
		readonly sessionId: string,
		readonly paragraphs: string[]
	) {}

	static paragraphText(nodeEl: Cheerio<Element>): string | null {
		if (nodeEl.children().length !== 0) {
			return null
		}
		return nodeEl.text().trim() || null
	}
}

function parseSessionFromHtml(html: string): DocxSession[] {
	const $ = load(html)
	const root = $.root()

	const sessions: DocxSession[] = []
	root.find(TOC_NODE_SELECTOR).each((_index, node) => {
		const titleText = DocxSession.getTitleFromParagraphElement($(node))
		if (!titleText) {
			return
		}
		const parsed = DocxSession.parseTitleToEntry(titleText)
		if (!parsed) {
			return
		}
		sessions.push(new DocxSession(`session-${sessions.length + 1}`, titleText, parsed.level, parsed.deepLevel, parsed.title))
	})
	return sessions
}

function splitParagraphsFromSession(sessions: DocxSession[], html: string): DocxParagraph[] {
	if (sessions.length === 0) {
		return []
	}
	const $ = load(html)
	// 移除没有文本且没有子元素的 a 标签，避免干扰章节内容提取
	$('a').each((_index, el) => {
		const $el = $(el)

		const text = $el.text().trim()
		const hasChildren = $el.children().length > 0

		if (!text && !hasChildren) {
			$el.remove()
		}
	})
	const root = $.root()

	const sessionIter = sessions[Symbol.iterator]()
	const paragraphsBySession: string[][] = []

	const docxPointer = {
		ptrSession: sessionIter.next().value,
		currSession: undefined as DocxSession | undefined,
		currParagraphs: undefined as string[] | undefined,
		nextSession() {
			this.currSession = this.ptrSession
			this.currParagraphs = []
			paragraphsBySession.push(this.currParagraphs)
			this.ptrSession = sessionIter.next().value
		},
	}

	root.find(TOC_NODE_SELECTOR).each((_index: number, node: Element) => {
		const nodeEl = $(node)
		if (docxPointer.ptrSession?.is(nodeEl)) {
			docxPointer.nextSession()
			return
		}
		const paragraphText = DocxParagraph.paragraphText(nodeEl)
		if (paragraphText && docxPointer.currParagraphs) {
			docxPointer.currParagraphs.push(paragraphText)
		}
	})

	return sessions.map((session, index) => new DocxParagraph(session.id, paragraphsBySession[index] ?? []))
}
export class DocxDocument {
	readonly sessions: DocxSession[]
	readonly paragraphs: DocxParagraph[]
	readonly paragraphMap: Map<string, DocxParagraph>
	private constructor(
		readonly rawText: string,
		readonly htmlText: string
	) {
		this.sessions = parseSessionFromHtml(htmlText)
		this.paragraphs = splitParagraphsFromSession(this.sessions, htmlText)
		this.paragraphMap = new Map(this.paragraphs.map((p) => [p.sessionId, p]))
	}

	static async load(filePath: string): Promise<DocxDocument> {
		const buffer = await fs.readFile(filePath)
		return this.loadFromBuffer(buffer)
	}

	static async loadFromBuffer(buffer: Buffer): Promise<DocxDocument> {
		const [rawResult, htmlResult] = await Promise.all([mammoth.extractRawText({ buffer }), mammoth.convertToHtml({ buffer })])
		// convertToHtml 没有rootElement 这里补个body方便找root
		return new DocxDocument(rawResult.value, `<body>${htmlResult.value}</body>`)
	}

	findSessionById(sessionId: string): DocxSession | undefined {
		return this.sessions.find((s) => s.id === sessionId)
	}

	findParagraphById(sessionId: string): DocxParagraph | undefined {
		return this.paragraphMap.get(sessionId)
	}
}
