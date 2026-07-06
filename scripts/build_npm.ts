import { build, emptyDir } from '@deno/dnt'

// 动态解析 deno.json
const denoJson = JSON.parse(await Deno.readTextFile('./deno.json'))
const { name, version, license } = denoJson as {
  name: string
  version: string
  license: string
}


await emptyDir('./npm')

await build({
  entryPoints: ['./index.ts'],
  outDir: './npm',
  shims: {
    deno: true,
  },
  package: {
    name,
    version: Deno.args[0] || version,
    description: 'DOCX 文本工具集，支持文档解析、图表引用查找、AI 审查等功能',
    license,
    repository: {
      type: 'git',
      url: 'git+https://github.com/RongdujiKsp/docx-utils.git',
    },
    bin: {
      'docx-utils': './esm/index.js',
    },
  },
  test: false,
  postBuild() {
    Deno.copyFileSync('README.md', 'npm/README.md')
  },
})
