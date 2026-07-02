import { extractRawText } from '../utils/docx.ts'

export async function echo(fileName: string, newlinePlaceholder?: string) {
  const text = await extractRawText(fileName)
  const echoText=newlinePlaceholder ? text.replace(/\r\n|\n|\r/g, newlinePlaceholder) : text
  console.log(echoText)
}
