import fs from "fs/promises";
import mammoth from "mammoth";

async function analyzeDocx(filePath:string) {
  const buffer = await fs.readFile(filePath);

  // 提取纯文本
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;

  let spaceCount = 0;
  const previews = [];

  const CONTEXT = 15; // 前后预览长度

  for (let i = 0; i < text.length; i++) {
    if (text[i] === " ") {
      spaceCount++;

      const start = Math.max(0, i - CONTEXT);
      const end = Math.min(text.length, i + CONTEXT);

      const snippet = `${text.slice(start, i)}[space]${text.slice(i + 1, end)}`;

      previews.push({
        index: i,
        preview: snippet.replace(/\n/g, "\\n")
      });
    }
  }

  console.log(`总空格数: ${spaceCount}`);

  previews.slice(0, 9999).forEach((p, i) => {
    console.log(`#${i + 1} [位置 ${p.index}]: ...${p.preview}...`);
  });
}

// 使用
const file = process.argv[2];
if (!file) {
  console.log("用法: bun run index.js <docx文件>");
  process.exit(1);
}

analyzeDocx(file);