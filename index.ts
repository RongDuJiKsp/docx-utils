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

type RefKind = "table" | "pic";
type RefMode = "def" | "use";

type RefMatch = {
  id: string;
  index: number;
  line: number;
  column: number;
  lineText: string;
};

function parseRefKind(rawValue: string): RefKind {
  if (rawValue === "table" || rawValue === "pic") {
    return rawValue;
  }
  throw new Error(`kind 只能是 table 或 pic，当前值: ${rawValue}`);
}

function parseRefMode(rawValue: string): RefMode {
  if (rawValue === "def" || rawValue === "use") {
    return rawValue;
  }
  throw new Error(`mode 只能是 def 或 use，当前值: ${rawValue}`);
}

function buildRefsRegex(kind: RefKind, mode: RefMode): RegExp {
  const label = kind === "table" ? "表" : "图";
  const id = `${label}\\d+-\\d+`;

  if (mode === "def") {
    return new RegExp(`(${id}) +(\\S+)`, "g");
  }

  return new RegExp(`(${id})(?=\\S|$|\\r|\\n)`, "g");
}

function buildLineStarts(text: string): number[] {
  const starts: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      starts.push(i + 1);
    }
  }
  return starts;
}

function upperBound(values: number[], target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    const v = values[mid];
    if (v === undefined) {
      high = mid;
      continue;
    }
    if (v <= target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

function highlightLine(lineText: string, column: number, idLength: number): string {
  const start = Math.max(0, column - 1);
  const end = Math.min(lineText.length, start + idLength);
  return `${lineText.slice(0, start)}[${lineText.slice(start, end)}]${lineText.slice(end)}`;
}

function findRefsInText(text: string, kind: RefKind, mode: RefMode): RefMatch[] {
  const regex = buildRefsRegex(kind, mode);
  const lineStarts = buildLineStarts(text);

  const matches: RefMatch[] = [];

  for (const m of text.matchAll(regex)) {
    const index = m.index ?? 0;
    const id = m[1] ?? m[0] ?? "";

    const lineIndex0 = Math.max(0, upperBound(lineStarts, index) - 1);
    const lineStart = lineStarts[lineIndex0] ?? 0;
    const lineNumber = lineIndex0 + 1;
    const column = index - lineStart + 1;

    const rawLineEnd = text.indexOf("\n", lineStart);
    const lineEnd = rawLineEnd === -1 ? text.length : rawLineEnd;
    const lineText = text.slice(lineStart, lineEnd).replace(/\r/g, "");

    matches.push({
      id,
      index,
      line: lineNumber,
      column,
      lineText
    });
  }

  return matches;
}

async function refs(filePath: string, kind: RefKind, mode: RefMode) {
  const text = await extractRawText(filePath);
  const matches = findRefsInText(text, kind, mode);

  const label = kind === "table" ? "表" : "图";
  const modeDesc =
    mode === "def"
      ? `${label}x-y + 空格 + 非空格{1,}`
      : `${label}x-y + (非空格 | 行尾)`;

  console.log(`匹配类型: ${kind}（${label}x-y）`);
  console.log(`匹配模式: ${mode}（${modeDesc}）`);
  console.log(`目标文件: ${filePath}`);
  console.log(`匹配数: ${matches.length}`);

  if (matches.length === 0) {
    return;
  }

  const counts = new Map<string, number>();
  for (const m of matches) {
    counts.set(m.id, (counts.get(m.id) ?? 0) + 1);
  }

  const sortedCounts = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  console.log("编号统计:");
  for (const [id, count] of sortedCounts) {
    console.log(`  ${id}: ${count}`);
  }

  console.log("明细:");
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (!m) {
      continue;
    }
    const linePreview = highlightLine(m.lineText, m.column, m.id.length);
    console.log(`#${i + 1} [第 ${m.line} 行, 第 ${m.column} 列]: ${linePreview}`);
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

program
  .command("refs")
  .description("查找图/表题（def）或引用（use）")
  .argument("<fileName>", "docx 文件路径")
  .argument("<kind>", "table|pic")
  .argument("<mode>", "def|use")
  .action(async (fileName: string, rawKind: string, rawMode: string) => {
    const kind = parseRefKind(rawKind);
    const mode = parseRefMode(rawMode);
    await refs(fileName, kind, mode);
  });

program.addHelpText(
  "after",
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