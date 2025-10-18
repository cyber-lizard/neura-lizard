import React from "react"
import { MessageRating } from "./MessageRating"

export interface ChatMessageShape {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  serverId?: number
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
  const blocks = React.useMemo(() => parseContentToBlocks(message.content || ""), [message.content])

  return (
    <div>
      <div className={isAssistant ? "bg-white border rounded p-3 shadow-sm" : ""}>
        <div className="mb-1 flex items-center justify-between">
          <div className="text-xs font-medium text-neutral-500">
            {message.role === "user" ? "You" : "Assistant"}
          </div>
        </div>

        <div className="space-y-3">
          {blocks.map((b, i) =>
            b.type === "code" ? (
              <pre
                key={`code-${i}`}
                className="max-w-full overflow-x-auto rounded border bg-neutral-50 p-3 text-xs leading-relaxed"
              >
                <code className={b.lang ? `language-${b.lang}` : undefined}>
                  {b.content}
                </code>
              </pre>
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