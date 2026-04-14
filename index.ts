#!/usr/bin/env bun

import { Command } from "commander";
import { extractRawText, parseNonNegativeInteger, resolveSliceRange } from "./utils";

async function echoRawText(filePath: string) {
  const text = await extractRawText(filePath);
  console.log(text.replace(/\r\n|\n|\r/g, "\\n"));
}

type FindSpaceOptions = {
  context: number;
};

async function findSpace(filePath: string, arg1?: number, arg2?: number, context = 10) {
  const text = await extractRawText(filePath);

  let spaceCount = 0;
  const previews: Array<{ index: number; preview: string }> = [];

  const previewContext = context;

  for (let i = 0; i < text.length; i++) {
    if (text[i] === " ") {
      spaceCount++;

      const start = Math.max(0, i - previewContext);
      const end = Math.min(text.length, i + previewContext);

      const snippet = `${text.slice(start, i)}[space]${text.slice(i + 1, end)}`;

      previews.push({
        index: i,
        preview: snippet.replace(/\n/g, "\\n")
      });
    }
  }

  console.log(`总空格数: ${spaceCount}`);

  const [sliceStart, sliceEnd] = resolveSliceRange(previews.length, arg1, arg2);
  console.log(`输出区间: [${sliceStart}, ${sliceEnd})`);

  for (let i = sliceStart; i < sliceEnd; i++) {
    const p = previews[i];
    if (!p) {
      continue;
    }

    console.log(`#${i + 1} [位置 ${p.index}]: ...${p.preview}...`);
  }
}

const program = new Command();

program
  .name("docx-utils")
  .description("DOCX 文本工具")
  .showHelpAfterError()
  .showSuggestionAfterError()
  .allowExcessArguments(false);

program
  .command("echo")
  .description("输出 rawText，并将换行显示为 \\n")
  .argument("<fileName>", "docx 文件路径")
  .action(async (fileName: string) => {
    await echoRawText(fileName);
  });

program
  .command("find-space")
  .description("统计空格数量并输出上下文")
  .argument("<fileName>", "docx 文件路径")
  .argument("[arg1]", "起始索引，非负整数")
  .argument("[arg2]", "结束索引，非负整数（左闭右开）")
  .option("-c, --context <length>", "预览长度，非负整数，默认 10", (value: string) => {
    return parseNonNegativeInteger(value, "context");
  }, 10)
  .action(async (fileName: string, rawArg1: string | undefined, rawArg2: string | undefined, options: FindSpaceOptions) => {
    const arg1 = parseNonNegativeInteger(rawArg1, "arg1");
    const arg2 = parseNonNegativeInteger(rawArg2, "arg2");

    await findSpace(fileName, arg1, arg2, options.context);
  });

program.addHelpText(
  "after",
  `
说明:
  未指定 arg1/arg2: 全部打印
  指定 arg1: 打印 [arg1, arg1+20)
  指定 arg1 和 arg2: 打印 [arg1, arg2)
  可选 --context/-c: 设置前后预览长度，默认 10
`
);

async function main() {
  if (Bun.argv.length <= 2) {
    program.help({ error: true });
  }

  await program.parseAsync(Bun.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`执行失败: ${message}`);
  process.exit(1);
});