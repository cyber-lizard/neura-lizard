import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock Button to a simple native button
vi.mock("@/components/ui/button", () => ({
  Button: (props: any) => <button {...props} />,
}))

// Provide a capturable mock dispatch via the hooks module
const mockDispatch = vi.fn()
vi.mock("@/hooks", () => ({
  __esModule: true,
  useAppDispatch: () => mockDispatch,
}))

// Hoist the action mock so it's available to the mock factory
const { sendMessageFeedbackMock } = vi.hoisted(() => ({
  sendMessageFeedbackMock: vi.fn((p: any) => ({
    type: "sendMessageFeedback",
    payload: p,
  })),
}))

vi.mock("@/store/chatSlice", () => ({
  __esModule: true,
  sendMessageFeedback: sendMessageFeedbackMock,
}))

import { MessageRating } from "../MessageRating"

describe("MessageRating", () => {
  beforeEach(() => {
    mockDispatch.mockClear()
    sendMessageFeedbackMock.mockClear()
  })

  it("renders two rating buttons", () => {
    render(<MessageRating messageId={123} />)
    expect(screen.getByRole("button", { name: /thumbs up/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /thumbs down/i })).toBeInTheDocument()
  })

  it("upvote toggles on -> off and dispatches feedback (1 -> 0)", () => {
    render(<MessageRating messageId={7} />)
    const up = screen.getByRole("button", { name: /thumbs up/i })
    fireEvent.click(up)
    expect(sendMessageFeedbackMock).toHaveBeenLastCalledWith({ id: 7, vote: 1 })
    expect(mockDispatch).toHaveBeenCalledTimes(1)
    fireEvent.click(up)
    expect(sendMessageFeedbackMock).toHaveBeenLastCalledWith({ id: 7, vote: 0 })
    expect(mockDispatch).toHaveBeenCalledTimes(2)
  })

  it("downvote then switch to up (−1 -> 1)", () => {
    render(<MessageRating messageId={42} />)
    const down = screen.getByRole("button", { name: /thumbs down/i })
    const up = screen.getByRole("button", { name: /thumbs up/i })
    fireEvent.click(down)
    expect(sendMessageFeedbackMock).toHaveBeenLastCalledWith({ id: 42, vote: -1 })
    fireEvent.click(up)
    expect(sendMessageFeedbackMock).toHaveBeenLastCalledWith({ id: 42, vote: 1 })
    expect(mockDispatch).toHaveBeenCalledTimes(2)
  })

  it("does nothing when disabled", () => {
    render(<MessageRating messageId={99} disabled />)
    const up = screen.getByRole("button", { name: /thumbs up/i })
    const down = screen.getByRole("button", { name: /thumbs down/i })
    fireEvent.click(up)
    fireEvent.click(down)
    expect(sendMessageFeedbackMock).not.toHaveBeenCalled()
    expect(mockDispatch).not.toHaveBeenCalled()
  })
})