import React from "react"
import { ArrowUp, Square } from "lucide-react"
import bg from "@/assets/images/button-bg.png"

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
        "group relative overflow-hidden px-3 py-2 rounded text-white text-sm disabled:opacity-50 flex items-center justify-center bg-no-repeat bg-center bg-cover " +
        className
      }
      style={{
        // Add a translucent overlay to improve contrast while keeping the image visible
        backgroundImage: `url(${bg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* subtle gloss on hover */}
      <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-white/10" />
      {isConnect ? (
        "Connect"
      ) : isStreaming ? (
        <Square className="h-4 w-4" strokeWidth={3}/>
      ) : (
        <ArrowUp className="h-4 w-4" strokeWidth={3} />
      )}
    </button>
  )
}
