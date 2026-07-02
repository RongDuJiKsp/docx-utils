import type { AnyNode, Element } from 'domhandler'
import { DocxDocument } from '../utils/docx.ts'

// 块级元素标签名集合
const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr', 'div', 'blockquote'])

/**
 * 类似 echo，打印文档纯文本，但对超链接在文本后面附加链接地址
 * 格式：(文本)[链接]
 */
export async function fmt(fileName: string) {
  const output: string[] = []
  let currentLine = ''

  await DocxDocument.dfs(fileName, (node: AnyNode): boolean => {
    if (node.type === 'tag') {
      const el = node as Element
      // 遇到块级元素开始时，将上一行推入输出
      if (BLOCK_TAGS.has(el.name)) {
        if (currentLine) {
          output.push(currentLine)
          currentLine = ''
        }
      }
      // 处理超链接，返回 false 跳过子节点
      if (el.name === 'a') {
        const text = getTextContent(el)
        const href = el.attribs?.['href'] || ''
        if (href && text) {
          currentLine += `(${text})[${href}]`
        } else {
          currentLine += text
        }
        return false
      }
      return true
    } else if (node.type === 'text') {
      currentLine += node.data || ''
    }
    return true
  })

  // 最后一行
  if (currentLine) {
    output.push(currentLine)
  }

  console.log(output.join('\n'))
}

/** 递归获取元素内的纯文本 */
function getTextContent(el: Element): string {
  let text = ''
  for (const child of el.children) {
    if (child.type === 'text') {
      text += child.data || ''
    } else if (child.type === 'tag') {
      text += getTextContent(child as Element)
    }
  }
  return text
}

