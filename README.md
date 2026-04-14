# docx-utils

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts echo ./demo.docx
bun run index.ts find-space ./demo.docx
bun run index.ts find-space ./demo.docx 5
bun run index.ts find-space ./demo.docx 5 12
```

CLI commands:

```bash
docx-utils echo <fileName>
docx-utils find-space <fileName> [arg1] [arg2]
```

- `echo`: 输出 `rawText`，并将换行显示为 `\n`。
- `find-space`: 统计空格数量并输出每个空格附近上下文。
- 未指定 `arg1/arg2`: 全部打印。
- 仅指定 `arg1`: 打印 `[arg1, arg1+20)`。
- 同时指定 `arg1` 和 `arg2`: 打印 `[arg1, arg2)`（左闭右开）。

This project was created using `bun init` in bun v1.3.1. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
