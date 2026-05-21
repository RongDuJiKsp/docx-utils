import { extractRawText } from '../utils/docx.ts'
import { resolveSliceRange } from '../utils/slice.ts'

export async function findSpace(filePath: string, arg1?: number, arg2?: number, context = 10) {
	const text = await extractRawText(filePath)

	let spaceCount = 0
	const previews: Array<{ index: number; preview: string }> = []

	const previewContext = context

	for (let i = 0; i < text.length; i++) {
		if (text[i] === ' ') {
			spaceCount++

			const start = Math.max(0, i - previewContext)
			const end = Math.min(text.length, i + previewContext)

			const snippet = `${text.slice(start, i)}[space]${text.slice(i + 1, end)}`

			previews.push({
				index: i,
				preview: snippet.replace(/\n/g, '\\n'),
			})
		}
	}

	console.log(`总空格数: ${spaceCount}`)

	const [sliceStart, sliceEnd] = resolveSliceRange(previews.length, arg1, arg2)
	console.log(`输出区间: [${sliceStart}, ${sliceEnd})`)

	for (let i = sliceStart; i < sliceEnd; i++) {
		const p = previews[i]
		if (!p) {
			continue
		}

		console.log(`#${i + 1} [位置 ${p.index}]: ...${p.preview}...`)
	}
}
