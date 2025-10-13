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

export default function ChatMessageItem({ message, streaming, isLastAssistant }: Props) {
  const isAssistant = message.role !== "user"

  return (
    <div>
      <div className={isAssistant ? "bg-white border rounded p-3 shadow-sm" : ""}>
        <div className="mb-1 flex items-center justify-between">
          <div className="text-xs font-medium text-neutral-500">
            {message.role === "user" ? "You" : "Assistant"}
          </div>
        </div>
        <div className="whitespace-pre-wrap text-sm">
          {message.content}
          {streaming && isLastAssistant && <span className="animate-pulse">▌</span>}
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