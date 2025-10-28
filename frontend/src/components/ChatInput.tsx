import React from "react"
import { RotateCcw } from "lucide-react"
import bg from "@/assets/images/button-bg.png"
import SendStopButton from "./SendStopButton"
import ModelSelect from "./ModelSelect"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onStop: () => void
  onReplay?: () => void
  streaming: boolean
  wsConnecting: boolean
  wsConnected: boolean
  placeholder?: string
  hasMessages?: boolean
}

export default function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  onReplay,
  streaming,
  wsConnecting,
  wsConnected,
  placeholder = "Ask something...",
  hasMessages = true,
}: Props) {
  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit() }}
      className="p-8 border-t flex gap-2"
    >
      <div className="flex-1 flex flex-col gap-2">
        <div className="flex gap-2 items-stretch">
          <button
            type="button"
            aria-label="Replay"
            className="group relative overflow-hidden h-24 w-10 shrink-0 rounded flex items-center justify-center text-white disabled:opacity-50 bg-no-repeat bg-center bg-cover"
            disabled={!hasMessages}
            onClick={() => { if (hasMessages) onReplay?.() }}
            style={{
              backgroundImage: `url(${bg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {/* subtle gloss on hover */}
            <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-white/10" />
            <RotateCcw className="h-4 w-4 drop-shadow" strokeWidth={3} />
          </button>
          <Textarea
            className="resize-none h-24 flex-1"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                if (!streaming) {
                  onSubmit()
                }
              }
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 w-48 items-end justify-end">
        <SendStopButton
          streaming={streaming}
          wsConnecting={wsConnecting}
          wsConnected={wsConnected}
          hasValue={!!value.trim()}
          onStop={onStop}
          className="w-full"
        />
        <div className="w-full mt-2 mt-auto">
          <ModelSelect disabled={wsConnecting || streaming} className="w-full" />
        </div>
      </div>
    </form>
  )
}