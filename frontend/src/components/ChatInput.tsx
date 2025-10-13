import React from "react"

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
      className="p-4 border-t flex gap-2"
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
              onSubmit()
            }
          }}
        />
      </div>

      <div className="flex flex-col gap-2 w-32">
        <button
          type="submit"
          disabled={!value.trim() || wsConnecting || streaming}
          className="px-3 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
        >
          {wsConnected ? (streaming ? "Streaming..." : "Send") : "Connect"}
        </button>
        {streaming && (
          <button
            type="button"
            onClick={onStop}
            className="px-3 py-2 rounded bg-neutral-300 text-sm"
          >
            Stop
          </button>
        )}
      </div>
    </form>
  )
}