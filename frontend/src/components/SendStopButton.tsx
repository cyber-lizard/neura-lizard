import React from "react"
import { ArrowUp, Square } from "lucide-react"

type Props = {
  streaming: boolean
  wsConnecting: boolean
  wsConnected: boolean
  hasValue: boolean
  onStop: () => void
  className?: string
}

export default function SendStopButton({
  streaming,
  wsConnecting,
  wsConnected,
  hasValue,
  onStop,
  className = "",
}: Props) {
  const isConnected = wsConnected
  const isStreaming = streaming && isConnected
  const isSend = isConnected && !streaming
  const isConnect = !isConnected

  const disabled = wsConnecting || (!streaming && !hasValue)
  const type: "button" | "submit" = streaming ? "button" : "submit"
  const ariaLabel = isStreaming ? "Stop" : isSend ? "Send" : "Connect"

  return (
    <button
      type={type}
      onClick={isStreaming ? onStop : undefined}
      disabled={disabled}
      aria-label={ariaLabel}
      className={
        "px-3 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50 flex items-center justify-center " +
        className
      }
    >
      {isConnect ? (
        "Connect"
      ) : isStreaming ? (
        <Square className="h-4 w-4" />
      ) : (
        <ArrowUp className="h-4 w-4" />
      )}
    </button>
  )
}
