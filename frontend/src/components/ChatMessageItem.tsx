
import React from "react"
import { Copy } from "lucide-react"
import { MessageRating } from "./MessageRating"

function copyToClipboard(text: string) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
  } else {
    // fallback for older browsers
    const textarea = document.createElement("textarea")
    textarea.value = text
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand("copy")
    document.body.removeChild(textarea)
  }
}

export interface ChatMessageShape {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  serverId?: number
  provider?: string
  model?: string
}

interface Props {
  message: ChatMessageShape
  streaming: boolean
  isLastAssistant: boolean
}

// Simple parser for ```lang\n...\n``` code fences
function parseContentToBlocks(text: string): Array<
  | { type: "code"; lang?: string; content: string }
  | { type: "text"; content: string }
> {
  const blocks: Array<any> = []
  const fence = /```([a-zA-Z0-9+#.\-_]*)\n([\s\S]*?)```/g
  let lastIndex = 0
  let m: RegExpExecArray | null

  while ((m = fence.exec(text)) !== null) {
    const [full, langRaw, code] = m
    const start = m.index
    if (start > lastIndex) {
      blocks.push({ type: "text", content: text.slice(lastIndex, start) })
    }
    const lang = (langRaw || "").trim() || undefined
    // Trim a single trailing newline inside the fence
    const codeTrimmed = code.replace(/\n$/, "")
    blocks.push({ type: "code", lang, content: codeTrimmed })
    lastIndex = start + full.length
  }
  if (lastIndex < text.length) {
    blocks.push({ type: "text", content: text.slice(lastIndex) })
  }

  // Fallback: no fences -> single text block
  if (blocks.length === 0) {
    blocks.push({ type: "text", content: text })
  }
  return blocks
}

export default function ChatMessageItem({ message, streaming, isLastAssistant }: Props) {
  const isAssistant = message.role !== "user"
  console.log("Rendering message from", message.role, "with provider/model:", message.provider, message.model);
  const blocks = React.useMemo(() => parseContentToBlocks(message.content || ""), [message.content])

  return (
    <div>
      <div className={isAssistant ? "bg-white border rounded p-3 shadow-sm" : ""}>
        <div className="mb-1 flex items-center justify-between">
          <div className="text-xs font-medium text-neutral-500">
            {message.role === "user"
              ? "You"
              : `Assistant${message.provider && message.model ? ` (${message.provider}, ${message.model})` : ""}`}
          </div>
        </div>

        <div className="space-y-3">
          {blocks.map((b, i) =>
            b.type === "code" ? (
              <div key={`code-${i}`} className="relative group">
                <pre
                  className="max-w-full overflow-x-auto rounded border bg-neutral-50 p-3 text-xs leading-relaxed"
                >
                  <code className={b.lang ? `language-${b.lang}` : undefined}>
                    {b.content}
                  </code>
                </pre>
                <button
                  type="button"
                  className="absolute top-2 right-2 opacity-70 group-hover:opacity-100 bg-neutral-200 hover:bg-neutral-300 text-xs px-2 py-1 rounded border shadow flex items-center gap-1"
                  onClick={() => copyToClipboard(b.content)}
                  aria-label="Copy code"
                >
                  <Copy className="h-4 w-4 text-neutral-600" strokeWidth={1.5} />
                  <span>Copy</span>
                </button>
              </div>
            ) : (
              <div key={`text-${i}`} className="whitespace-pre-wrap text-sm">
                {b.content}
                {streaming && isLastAssistant && i === blocks.length - 1 && (
                  <span className="animate-pulse">▌</span>
                )}
              </div>
            )
          )}
        </div>
      </div>

      {isAssistant && (
        <div className="mt-2 flex justify-end">
          <MessageRating
            messageId={message.serverId ?? Number(message.id)}
            disabled={streaming && isLastAssistant}
          />
        </div>
      )}
    </div>
  )
}