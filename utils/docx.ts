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

const ANCHOR_NUMBER_RE = /^\d+(?:\.\d+)+$/

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
	const [numbering, title] = normalized.split(/\s+/)
	if (!numbering || !title || !ANCHOR_NUMBER_RE.test(numbering)) {
		return null
	}
	const level = numbering.split('.').length
	return { level, title }
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

	const appendParagraph = (value: string) => {
		if (!current) {
			return
		}
		const text = value.replace(/\s+/g, ' ').trim()
		if (text === '') {
			return
		}
		current.parts.push(text)
		current.parts.push('\n')
	}

	root.find('p').each((index: number, node: cheerio.AnyNode) => {
		void index
		const paragraphText = normalizeTitle($(node).text())
		if (paragraphText === '') {
			return
		}
		const heading = parseAnchorHeading(paragraphText)
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
		appendParagraph(paragraphText)
	})

	flushSection()

	return { sections, anchorCount }
}



export type DocxSession={
  id:string, //session-xxx
  title:string, // 章节标题
  level:number,// 章节层级
  deepLevel:string[],// 深层级路径，如 ["1","2"] 表示 1.2
  rawText:string,// 原始文本
}
export type DocxParagraph={
  sessionId:string,//所属章节id
  paragraphs:string[],//每段文本
}

function parseSessionFromHtml(html:string):DocxSession[]{

}

function splitParagraphsFromSession(sessions: DocxSession[]): DocxParagraph[] {

}
export class DocxDocument{
  readonly sessions: DocxSession[]
  readonly paragraphs: DocxParagraph[]
  readonly paragraphMap: Map<string, DocxParagraph>
 private constructor(private readonly buffer: Buffer, readonly rawText:string, readonly htmlText:string){
this.sessions = parseSessionFromHtml(htmlText)
this.paragraphs = splitParagraphsFromSession(this.sessions)
this.paragraphMap = new Map(this.paragraphs.map(p => [p.sessionId, p]))

 }
 private static async parseFromBuffer(buffer: Buffer){
  const [rawResult, htmlResult] = await Promise.all([mammoth.extractRawText({ buffer }), mammoth.convertToHtml({ buffer })])
  return {
   rawText: rawResult.value,
   htmlText: htmlResult.value,
  }
 }
 static async load(filePath: string): Promise<DocxDocument> {
  const buffer = await fs.readFile(filePath)
  const { rawText, htmlText } = await this.parseFromBuffer(buffer)
  return new DocxDocument(buffer, rawText, htmlText)
 }

 findSessionById(sessionId: string): DocxSession | undefined {
  return this.sessions.find(s => s.id === sessionId)
 }

 findParagraphById(sessionId: string): DocxParagraph | undefined {
  return this.paragraphMap.get(sessionId)
 }
}