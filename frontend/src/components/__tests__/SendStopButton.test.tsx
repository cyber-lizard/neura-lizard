import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"

import SendStopButton from "../SendStopButton"

describe("SendStopButton", () => {
  it("renders Connect and respects hasValue/connecting state", () => {
    const onStop = vi.fn()

    // Not connected, no value -> disabled (same behavior as ChatInput prior to refactor)
    const { rerender } = render(
      <SendStopButton
        streaming={false}
        wsConnecting={false}
        wsConnected={false}
        hasValue={false}
        onStop={onStop}
      />
    )

    const connectBtn = screen.getByRole("button", { name: /connect/i })
    expect(connectBtn).toBeDisabled()

    // Not connected, has value -> enabled
    rerender(
      <SendStopButton
        streaming={false}
        wsConnecting={false}
        wsConnected={false}
        hasValue={true}
        onStop={onStop}
      />
    )
    expect(screen.getByRole("button", { name: /connect/i })).toBeEnabled()

    // While connecting -> disabled regardless
    rerender(
      <SendStopButton
        streaming={false}
        wsConnecting={true}
        wsConnected={false}
        hasValue={true}
        onStop={onStop}
      />
    )
    expect(screen.getByRole("button", { name: /connect/i })).toBeDisabled()
  })

  it("shows Send (ArrowUp) as submit when connected and input has value", () => {
    render(
      <SendStopButton
        streaming={false}
        wsConnecting={false}
        wsConnected={true}
        hasValue={true}
        onStop={() => {}}
      />
    )

    const sendBtn = screen.getByRole("button", { name: /send/i })
    expect(sendBtn).toBeEnabled()
    expect(sendBtn.getAttribute("type")).toBe("submit")
  })

  it("shows Stop (Square) as button and calls onStop when streaming", () => {
    const onStop = vi.fn()
    render(
      <SendStopButton
        streaming={true}
        wsConnecting={false}
        wsConnected={true}
        hasValue={true}
        onStop={onStop}
      />
    )

    const stopBtn = screen.getByRole("button", { name: /stop/i })
    expect(stopBtn).toBeEnabled()
    expect(stopBtn.getAttribute("type")).toBe("button")

    fireEvent.click(stopBtn)
    expect(onStop).toHaveBeenCalledTimes(1)
  })

  it("disables during wsConnecting in any state", () => {
    const { rerender } = render(
      <SendStopButton
        streaming={false}
        wsConnecting={true}
        wsConnected={true}
        hasValue={true}
        onStop={() => {}}
      />
    )
    expect(screen.getByRole("button", { name: /send|stop|connect/i })).toBeDisabled()

    rerender(
      <SendStopButton
        streaming={true}
        wsConnecting={true}
        wsConnected={true}
        hasValue={true}
        onStop={() => {}}
      />
    )
    expect(screen.getByRole("button", { name: /send|stop|connect/i })).toBeDisabled()
  })
})
