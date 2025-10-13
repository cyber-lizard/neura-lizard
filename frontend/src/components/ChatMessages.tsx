import React from "react"
import ChatMessageItem, { ChatMessageShape } from "./ChatMessageItem"

interface Props {
  messages: ChatMessageShape[]
  streaming: boolean
  error?: string | null
  innerRef?: React.RefObject<HTMLDivElement>
}

export default function ChatMessages({ messages, streaming, error, innerRef }: Props) {
  return (
    <div ref={innerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-50">
      {messages.map((m, i) => {
        const isAssistant = m.role !== "user"
        const isLastAssistant = isAssistant && i === messages.length - 1
        return (
          <ChatMessageItem
            key={m.id}
            message={m}
            streaming={streaming}
            isLastAssistant={isLastAssistant}
          />
        )
      })}
      {messages.length === 0 && !error && (
        <div className="text-neutral-400 text-sm">Start a conversation…</div>
      )}
      {error && <div className="text-red-600 text-sm font-medium">Error: {error}</div>}
    </div>
  )
}