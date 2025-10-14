import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"

// Mock MessageRating so we can assert it renders and receives props
vi.mock("../MessageRating", () => ({
  MessageRating: ({ disabled, messageId }: any) => (
    <div data-testid="rating" data-disabled={disabled ? "1" : "0"}>
      {String(messageId)}
    </div>
  ),
}))

import ChatMessageItem from "../ChatMessageItem"

describe("ChatMessageItem", () => {
  it("renders user message without rating", () => {
    render(
      <ChatMessageItem
        message={{ id: "1", role: "user", content: "Hi" }}
        streaming={false}
        isLastAssistant={false}
      />
    )
    expect(screen.queryByTestId("rating")).toBeNull()
    expect(screen.getByText("You")).toBeInTheDocument()
    expect(screen.getByText("Hi")).toBeInTheDocument()
  })

  it("renders assistant message with rating", () => {
    render(
      <ChatMessageItem
        message={{ id: "2", role: "assistant", content: "Hello", serverId: 42 }}
        streaming={false}
        isLastAssistant={false}
      />
    )
    expect(screen.getByTestId("rating")).toBeInTheDocument()
    expect(screen.getByText("Hello")).toBeInTheDocument()
  })

  it("disables rating and shows cursor while streaming last assistant", () => {
    render(
      <ChatMessageItem
        message={{ id: "3", role: "assistant", content: "Typing..." }}
        streaming={true}
        isLastAssistant={true}
      />
    )
    expect(screen.getByTestId("rating")).toHaveAttribute("data-disabled", "1")
    expect(screen.getByText(/▌/)).toBeInTheDocument()
  })
})