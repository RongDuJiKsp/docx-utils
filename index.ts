#!/usr/bin/env -S deno run -A

import { Command } from 'commander'
import { echo } from './commands/echo.ts'
import { fmt } from './commands/fmt.ts'
import { findSpace } from './commands/find-space.ts'
import { parseRefKind, parseRefMode, refs } from './commands/refs.ts'
import { aiReview } from './commands/ai-review.ts'
import { parseNonNegativeInteger } from './utils/numbers.ts'
import { ensureEnvLoaded } from './utils/env.ts'
import process from 'node:process'

type FindSpaceOptions = {
  context: number
}

type AiReviewOptions = {
  rules: string
  maxIterations?: number
}

const program = new Command()

program.name('docx-utils').description('DOCX 文本工具').showHelpAfterError()
  .showSuggestionAfterError().allowExcessArguments(false)

program.command('echo').description('输出 rawText')
  .argument('<fileName>', 'docx 文件路径')
  .argument('[newlinePlaceholder]', '换行符占位符，不指定则直接输出换行符')
  .action(echo)

program.command('fmt').description('输出文本，超链接以 (文本)[链接] 格式展示')
  .argument('<fileName>', 'docx 文件路径')
  .option('--show-link', '显示超链接地址')
  .action((fileName: string, options: { showLink?: boolean }) =>
    fmt(fileName, options)
  )

program
  .command('find-space')
  .description('统计空格数量并输出上下文')
  .argument('<fileName>', 'docx 文件路径')
  .argument('[arg1]', '起始索引，非负整数')
  .argument('[arg2]', '结束索引，非负整数（左闭右开）')
  .option(
    '-c, --context <length>',
    '预览长度，非负整数，默认 10',
    (value: string) => {
      return parseNonNegativeInteger(value, 'context')
    },
    10,
  )
  .action(
    async (
      fileName: string,
      rawArg1: string | undefined,
      rawArg2: string | undefined,
      options: FindSpaceOptions,
    ) => {
      const arg1 = parseNonNegativeInteger(rawArg1, 'arg1')
      const arg2 = parseNonNegativeInteger(rawArg2, 'arg2')

      await findSpace(fileName, arg1, arg2, options.context)
    },
  )

program
  .command('refs')
  .description('查找图/表题（def）或引用（use）')
  .argument('<fileName>', 'docx 文件路径')
  .argument('<kind>', 'table|pic')
  .argument('<mode>', 'def|use')
  .action(async (fileName: string, rawKind: string, rawMode: string) => {
    const kind = parseRefKind(rawKind)
    const mode = parseRefMode(rawMode)
    await refs(fileName, kind, mode)
  })

program
  .command('ai-review')
  .description('章节审查（AI）')
  .argument('<fileName>', 'docx 文件路径')
  .requiredOption('-r, --rules <fileName>', '规则文件路径（markdown）')
  .option(
    '--max-iterations <count>',
    '最大迭代次数（默认从环境变量读取）',
    (value: string) => {
      return parseNonNegativeInteger(value, 'max-iterations')
    },
  )
  .action(async (fileName: string, options: AiReviewOptions) => {
    await aiReview(fileName, options)
  })

program.addHelpText(
  'after',
  `
说明:
  未指定 arg1/arg2: 全部打印
  指定 arg1: 打印 [arg1, arg1+20)
  指定 arg1 和 arg2: 打印 [arg1, arg2)
  可选 --context/-c: 设置前后预览长度，默认 10

refs:
  用于查找图/表的“定义”(def)或“使用”(use)
  用法: docx-utils refs <fileName> <table|pic> <def|use>
  table 匹配 表x-y
  pic 匹配 图x-y
  def 匹配: 图/表x-y + 空格 + 非空格{1,}
  use 匹配: 图/表x-y + 非空格 或 行尾
`,
)

async function main() {
  if (process.argv.length <= 2) {
    program.help({ error: true })
  }

  ensureEnvLoaded()

  await program.parseAsync(process.argv)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`执行失败: ${message}`)
  console.error('错误栈:', error instanceof Error ? error.stack : '无')
  console.log('原始错误：\n\n')
  throw error
})
