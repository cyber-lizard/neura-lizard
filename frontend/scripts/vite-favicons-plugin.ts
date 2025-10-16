import type { Plugin } from "vite"
import path from "node:path"
import fs from "node:fs/promises"
import sharp from "sharp"

type Options = {
  src: string // source image (PNG/SVG recommended), relative to project root
  outDir?: string // where to write assets (default: public at project root)
}

const PNG_SIZES = [16, 32, 48, 180, 192, 512]

export default function faviconsPlugin(opts: Options): Plugin {
  return {
    name: "favicons-from-image",
    apply: "serve",
    enforce: "pre",
    async configResolved(config) {
      await generate(config.root, opts)
    },
    transformIndexHtml(html) {
      // inject tags once (safe if already present)
      const tags: import("vite").HtmlTagDescriptor[] = [
        { tag: "link", attrs: { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" }, injectTo: "head" as const },
        { tag: "link", attrs: { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" }, injectTo: "head" as const },
        { tag: "link", attrs: { rel: "icon", type: "image/png", sizes: "48x48", href: "/favicon-48x48.png" }, injectTo: "head" as const },
        { tag: "link", attrs: { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" }, injectTo: "head" as const },
        { tag: "link", attrs: { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" }, injectTo: "head" as const },
        { tag: "link", attrs: { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" }, injectTo: "head" as const },
        { tag: "link", attrs: { rel: "shortcut icon", href: "/favicon.ico" }, injectTo: "head" as const },
      ]
      return { html, tags }
    },
  }
}

export function faviconsPluginBuild(opts: Options): Plugin {
  return {
    name: "favicons-from-image:build",
    apply: "build",
    enforce: "pre",
    async configResolved(config) {
      await generate(config.root, opts)
    },
  }
}

async function generate(root: string, opts: Options) {
  const srcPath = path.resolve(root, opts.src)
  const outDir = path.resolve(root, opts.outDir ?? "public")
  await fs.mkdir(outDir, { recursive: true })

  // read source once
  const input = await fs.readFile(srcPath)

  // create PNG sizes
  await Promise.all(
    PNG_SIZES.map(async (size) => {
      const png = await sharp(input).resize(size, size, { fit: "contain", background: "#ffffff" }).png().toBuffer()
      const name =
        size === 180 ? "apple-touch-icon.png" :
        size === 192 ? "icon-192.png" :
        size === 512 ? "icon-512.png" :
        `favicon-${size}x${size}.png`
      await fs.writeFile(path.join(outDir, name), png)
    })
  )

  // build ICO (pack 16/32/48 PNGs)
  const p16 = await fs.readFile(path.join(outDir, "favicon-16x16.png"))
  const p32 = await fs.readFile(path.join(outDir, "favicon-32x32.png"))
  const p48 = await fs.readFile(path.join(outDir, "favicon-48x48.png"))
  const ico = buildIcoFromPngs([p16, p32, p48])
  await fs.writeFile(path.join(outDir, "favicon.ico"), ico)
}

function buildIcoFromPngs(images: Buffer[]): Buffer {
  const count = images.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type = icon
  header.writeUInt16LE(count, 4)

  const dir = Buffer.alloc(16 * count)
  let offset = 6 + dir.length
  images.forEach((img, i) => {
    // width/height are in the first PNG IHDR chunk (bytes 16-19)
    const w = imagesToSize(img)
    const h = w
    const entry = i * 16
    dir.writeUInt8(w >= 256 ? 0 : w, entry + 0)
    dir.writeUInt8(h >= 256 ? 0 : h, entry + 1)
    dir.writeUInt8(0, entry + 2) // colors
    dir.writeUInt8(0, entry + 3) // reserved
    dir.writeUInt16LE(1, entry + 4) // planes
    dir.writeUInt16LE(32, entry + 6) // bit count
    dir.writeUInt32LE(img.length, entry + 8)
    dir.writeUInt32LE(offset, entry + 12)
    offset += img.length
  })

  return Buffer.concat([header, dir, ...images])
}

function imagesToSize(png: Buffer): number {
  // PNG IHDR chunk: width (4 bytes) at offset 16
  return png.readUInt32BE(16)
}