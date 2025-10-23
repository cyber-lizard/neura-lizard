import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"

// Stub ModelSelect to avoid Redux dependency in these unit tests
vi.mock("../ModelSelect", () => ({
  __esModule: true,
  default: () => <div data-testid="model-select">ModelSelect</div>,
}))

import ChatInput from "../ChatInput"

describe("ChatInput", () => {
  it("disables submit when empty", () => {
    render(
      <ChatInput
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        onStop={() => {}}
        streaming={false}
        wsConnecting={false}
        wsConnected={true}
      />
    )
    expect(screen.getByRole("button", { name: /send|connect/i })).toBeDisabled()
  })

  it("calls onSubmit on form submit", () => {
    const onSubmit = vi.fn()
    render(
      <ChatInput
        value="Hello"
        onChange={() => {}}
        onSubmit={onSubmit}
        onStop={() => {}}
        streaming={false}
        wsConnecting={false}
        wsConnected={true}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /send/i }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("Enter submits, Shift+Enter does not", () => {
    const onSubmit = vi.fn()
    render(
      <ChatInput
        value="Hello"
        onChange={() => {}}
        onSubmit={onSubmit}
        onStop={() => {}}
        streaming={false}
        wsConnecting={false}
        wsConnected={true}
      />
    )
    const textarea = screen.getByRole("textbox")
    fireEvent.keyDown(textarea, { key: "Enter" })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true })
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it("shows Stop when streaming and calls onStop", () => {
    const onStop = vi.fn()
    render(
      <ChatInput
        value="Hello"
        onChange={() => {}}
        onSubmit={() => {}}
        onStop={onStop}
        streaming={true}
        wsConnecting={false}
        wsConnected={true}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /stop/i }))
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it("button label switches by connection/streaming", () => {
    const { rerender } = render(
      <ChatInput
        value="Hello"
        onChange={() => {}}
        onSubmit={() => {}}
        onStop={() => {}}
        streaming={false}
        wsConnecting={false}
        wsConnected={false}
      />
    )
    expect(screen.getByRole("button", { name: /connect/i })).toBeInTheDocument()

    rerender(
      <ChatInput
        value="Hello"
        onChange={() => {}}
        onSubmit={() => {}}
        onStop={() => {}}
        streaming={false}
        wsConnecting={false}
        wsConnected={true}
      />
    )
  expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument()

    rerender(
      <ChatInput
        value="Hello"
        onChange={() => {}}
        onSubmit={() => {}}
        onStop={() => {}}
        streaming={true}
        wsConnecting={false}
        wsConnected={true}
      />
    )
    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument()
  })
})