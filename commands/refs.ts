import { extractRawText } from '../utils/docx.ts'

export type RefKind = 'table' | 'pic'
export type RefMode = 'def' | 'use'

type RefMatch = {
  id: string
  index: number
  line: number
  column: number
  lineText: string
}

export function parseRefKind(rawValue: string): RefKind {
  if (rawValue === 'table' || rawValue === 'pic') {
    return rawValue
  }
  throw new Error(`kind 只能是 table 或 pic，当前值: ${rawValue}`)
}

export function parseRefMode(rawValue: string): RefMode {
  if (rawValue === 'def' || rawValue === 'use') {
    return rawValue
  }
  throw new Error(`mode 只能是 def 或 use，当前值: ${rawValue}`)
}

function buildRefsRegex(kind: RefKind, mode: RefMode): RegExp {
  const label = kind === 'table' ? '表' : '图'
  const id = `${label}\\d+-\\d+`

  if (mode === 'def') {
    return new RegExp(`(${id}) +(\\S+)`, 'g')
  }

  return new RegExp(`(${id})(?=\\S|$|\\r|\\n)\\S*`, 'g')
}

function buildLineStarts(text: string): number[] {
  const starts: number[] = [0]
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      starts.push(i + 1)
    }
  }
  return starts
}

function upperBound(values: number[], target: number): number {
  let low = 0
  let high = values.length
  while (low < high) {
    const mid = (low + high) >> 1
    const v = values[mid]
    if (v === undefined) {
      high = mid
      continue
    }
    if (v <= target) {
      low = mid + 1
    } else {
      high = mid
    }
  }
  return low
}

function highlightLine(
  lineText: string,
  column: number,
  idLength: number,
): string {
  const start = Math.max(0, column - 1)
  const end = Math.min(lineText.length, start + idLength)
  return `${lineText.slice(0, start)}[${lineText.slice(start, end)}]${
    lineText.slice(end)
  }`
}

function findRefsInText(
  text: string,
  kind: RefKind,
  mode: RefMode,
): RefMatch[] {
  const regex = buildRefsRegex(kind, mode)
  const lineStarts = buildLineStarts(text)

  const matches: RefMatch[] = []

  for (const m of text.matchAll(regex)) {
    const index = m.index ?? 0
    const id = m[1] ?? m[0] ?? ''

    const lineIndex0 = Math.max(0, upperBound(lineStarts, index) - 1)
    const lineStart = lineStarts[lineIndex0] ?? 0
    const lineNumber = lineIndex0 + 1
    const column = index - lineStart + 1

    const rawLineEnd = text.indexOf('\n', lineStart)
    const lineEnd = rawLineEnd === -1 ? text.length : rawLineEnd
    const lineText = text.slice(lineStart, lineEnd).replace(/\r/g, '')

    matches.push({
      id,
      index,
      line: lineNumber,
      column,
      lineText,
    })
  }

  return matches
}

async function runRefs(filePath: string, kind: RefKind, mode: RefMode) {
  const text = await extractRawText(filePath)
  const matches = findRefsInText(text, kind, mode)

  const label = kind === 'table' ? '表' : '图'
  const modeDesc = mode === 'def'
    ? `${label}x-y + 空格 + 非空格{1,}`
    : `${label}x-y + (非空格 | 行尾)`

  console.log(`匹配类型: ${kind}（${label}x-y）`)
  console.log(`匹配模式: ${mode}（${modeDesc}）`)
  console.log(`目标文件: ${filePath}`)
  console.log(`匹配数: ${matches.length}`)

  if (matches.length === 0) {
    return
  }

  const counts = new Map<string, number>()
  for (const m of matches) {
    counts.set(m.id, (counts.get(m.id) ?? 0) + 1)
  }

  const sortedCounts = [...counts.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )
  console.log('编号统计:')
  for (const [id, count] of sortedCounts) {
    console.log(`  ${id}: ${count}`)
  }

  console.log('明细:')
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
    if (!m) {
      continue
    }
    const linePreview = highlightLine(m.lineText, m.column, m.id.length)
    console.log(
      `#${i + 1} [第 ${m.line} 行, 第 ${m.column} 列]: ${linePreview}`,
    )
  }
}

export async function refs(fileName: string, kind: RefKind, mode: RefMode) {
  await runRefs(fileName, kind, mode)
}
