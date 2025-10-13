import { useCallback, useState } from "react"
import { ThumbsDown, ThumbsUp } from "lucide-react"
import { useAppDispatch } from "@/hooks"
import { sendMessageFeedback } from "@/store/chatSlice"
import { Button } from "@/components/ui/button"

type Props = {
  messageId: number
  disabled?: boolean
}

export function MessageRating({ messageId, disabled }: Props) {
  const d = useAppDispatch()
  const [vote, setVote] = useState<null | "up" | "down">(null)

  const onVote = useCallback(
    (dir: "up" | "down") => {
      const next = vote === dir ? null : dir
      setVote(next)
      console.log(messageId)
      const payload: { id: number; vote: 0 | 1 | -1 } =
        next === null
          ? { id: messageId, vote: 0 }
          : { id: messageId, vote: next === "up" ? 1 : -1 }
      console.log(payload)
      d(sendMessageFeedback(payload))
    },
    [d, messageId, vote]
  )

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        size="icon"
        variant={vote === "up" ? "default" : "ghost"}
        className="h-7 w-7"
        onClick={() => onVote("up")}
        disabled={disabled}
        aria-label="Thumbs up"
        title="Thumbs up"
      >
        <ThumbsUp className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant={vote === "down" ? "default" : "ghost"}
        className="h-7 w-7"
        onClick={() => onVote("down")}
        disabled={disabled}
        aria-label="Thumbs down"
        title="Thumbs down"
      >
        <ThumbsDown className="h-4 w-4" />
      </Button>
    </div>
  )
}