import React from "react"
import { useAppSelector, useAppDispatch } from "../hooks"
import { setModel } from "../store/chatSlice"
import { CheckCircle, Sparkles, Zap, Info } from "lucide-react"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"

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

function modelIcon(model: string) {
  if (/mini/i.test(model)) return <Zap className="inline h-4 w-4 text-yellow-500 mr-1" />
  if (/pro|large/i.test(model)) return <Sparkles className="inline h-4 w-4 text-purple-500 mr-1" />
  return <CheckCircle className="inline h-4 w-4 text-blue-500 mr-1" />
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
  const dispatch = useAppDispatch()
  const { models, model } = useAppSelector(s => s.chat)

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
              onSubmit()
            }
          }}
        />
      </div>

      <div className="flex flex-col gap-2 w-48 items-end justify-end">
        <button
          type="submit"
          disabled={!value.trim() || wsConnecting || streaming}
          className="px-3 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50 w-full"
        >
          {wsConnected ? (streaming ? "Streaming..." : "Send") : "Connect"}
        </button>
        {streaming && (
          <button
            type="button"
            onClick={onStop}
            className="px-3 py-2 rounded bg-neutral-300 text-sm w-full"
          >
            Stop
          </button>
        )}
        <div className="w-full mt-2 mt-auto">
          <Select
            value={model || ""}
            onValueChange={val => {
              if (val) dispatch(setModel(val))
            }}
            disabled={wsConnecting || streaming}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {models.length === 0 ? (
                <div className="px-3 py-2 text-xs text-neutral-400">No models available</div>
              ) : (
                models.map(m => (
                  <SelectItem key={m} value={m}>
                    <span className="flex items-center gap-2">
                      {modelIcon(m)}
                      <span>{m}</span>
                    </span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
    </form>
  )
}