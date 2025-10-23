import React from "react"
import SendStopButton from "./SendStopButton"
import ModelSelect from "./ModelSelect"

type Props = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onStop: () => void
  streaming: boolean
  wsConnecting: boolean
  wsConnected: boolean
  placeholder?: string
}

export default function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  streaming,
  wsConnecting,
  wsConnected,
  placeholder = "Ask something...",
}: Props) {
  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit() }}
      className="p-8 border-t flex gap-2"
    >
      <div className="flex-1 flex flex-col gap-2">
        <textarea
          className="border rounded p-2 text-sm resize-none h-24"
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