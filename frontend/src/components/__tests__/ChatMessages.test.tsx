import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"

// Mock ChatMessageItem to isolate ChatMessages behavior
vi.mock("../ChatMessageItem", () => ({
  __esModule: true,
  default: ({ message }: any) => <div data-testid="msg">{message.content}</div>,
}))

import ChatMessages from "../ChatMessages"

describe("ChatMessages", () => {
  it("renders list of messages", () => {
    render(
      <ChatMessages
        messages={[
          { id: "1", role: "user", content: "A" },
          { id: "2", role: "assistant", content: "B" },
        ] as any}
        streaming={false}
        error={null}
      />
    )
    const items = screen.getAllByTestId("msg")
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent("A")
    expect(items[1]).toHaveTextContent("B")
  })

  it("shows empty state when no messages and no error", () => {
    render(<ChatMessages messages={[]} streaming={false} error={null} />)
    expect(screen.getByText(/start a conversation/i)).toBeInTheDocument()
  })

  it("shows error when provided", () => {
    render(<ChatMessages messages={[]} streaming={false} error="Oops" />)
    expect(screen.getByText(/oops/i)).toBeInTheDocument()
  })
})