import React from "react"
import { useAppDispatch, useAppSelector } from "../hooks"
import { setModel } from "../store/chatSlice"
import { CheckCircle, Sparkles, Zap } from "lucide-react"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"

type Props = {
  disabled?: boolean
  className?: string
}

function modelIcon(model: string) {
  if (/mini/i.test(model)) return <Zap className="inline h-4 w-4 text-yellow-500 mr-1" />
  if (/pro|large/i.test(model)) return <Sparkles className="inline h-4 w-4 text-purple-500 mr-1" />
  return <CheckCircle className="inline h-4 w-4 text-blue-500 mr-1" />
}

export default function ModelSelect({ disabled = false, className }: Props) {
  const dispatch = useAppDispatch()
  const { models, model } = useAppSelector((s) => s.chat)

  return (
    <div className={className}>
      <Select
        value={model || ""}
        onValueChange={(val) => {
          if (val) dispatch(setModel(val))
        }}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select model" />
        </SelectTrigger>
        <SelectContent>
          {models.length === 0 ? (
            <div className="px-3 py-2 text-xs text-neutral-400">No models available</div>
          ) : (
            models.map((m) => (
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
  )
}
