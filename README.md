# docx-utils

To install dependencies:

```bash
deno install
```

To run:

```bash
docx-utils echo ./demo.docx
docx-utils find-space ./demo.docx
docx-utils find-space ./demo.docx 5
docx-utils find-space ./demo.docx 5 12
docx-utils find-space ./demo.docx 5 12 --context 20
docx-utils refs ./demo.docx pic def
docx-utils refs ./demo.docx pic use
docx-utils refs ./demo.docx table def
docx-utils refs ./demo.docx table use
docx-utils ai-review ./demo.docx --rules ./rules.md
docx-utils ai-review ./demo.docx --rules ./rules.md --max-iterations 20
```

CLI commands:

```bash
docx-utils echo <fileName>
docx-utils find-space [options] <fileName> [arg1] [arg2]
docx-utils refs <fileName> <table|pic> <def|use>
docx-utils ai-review <fileName> --rules <rules.md> [--max-iterations <n>]
```

- `echo`: 输出 `rawText`，并将换行显示为 `\n`。
- `find-space`: 统计空格数量并输出每个空格附近上下文。
- `refs`: 查找图/表题（def）或引用（use）。
- `ai-review`: 使用 AI 按章节规则审查 docx 内容。
- 未指定 `arg1/arg2`: 全部打印。
- 仅指定 `arg1`: 打印 `[arg1, arg1+20)`。
- 同时指定 `arg1` 和 `arg2`: 打印 `[arg1, arg2)`（左闭右开）。
- 可选 `--context/-c`: 设置前后预览长度，默认 `10`。

`refs` 用法说明：

```bash
# 固定参数顺序
docx-utils refs <fileName> <table|pic> <def|use>

# 常见示例
docx-utils refs ./demo.docx pic def
docx-utils refs ./demo.docx pic use
docx-utils refs ./demo.docx table def
docx-utils refs ./demo.docx table use
```

匹配规则：

- `table`: 匹配 `表x-y`
- `pic`: 匹配 `图x-y`
- `def`: 匹配“定义”：`图/表x-y` + 空格 + 非空格{1,}
- `use`: 匹配“使用”：`图/表x-y` 后直接接非空格或行尾

AI 审查配置（.env / .env.local）：

- `.env` 和 `.env.local` 都会被加载，`.env.local` 会覆盖同名配置。
- provider 的 model/base URL 必须配置，否则会直接报错。
- 支持 `openai` 和 `deepseek` provider。
- 示例已放在项目根目录的 `.env` 文件中。
