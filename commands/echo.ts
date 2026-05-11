import { extractRawText } from "../utils/docx";

export async function echo(fileName: string) {
  const text = await extractRawText(fileName);
  console.log(text.replace(/\r\n|\n|\r/g, "\\n"));
}
