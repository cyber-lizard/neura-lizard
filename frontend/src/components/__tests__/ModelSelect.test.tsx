import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"

// Minimal mock for shadcn Select components to make interaction deterministic in JSDOM
vi.mock("@/components/ui/select", () => {
  const state: any = { onValueChange: undefined, disabled: false }
  return {
    __esModule: true,
    Select: ({ children, onValueChange, disabled }: any) => {
      state.onValueChange = onValueChange
      state.disabled = !!disabled
      return <div data-testid="select-root">{children}</div>
    },
    SelectTrigger: (props: any) => (
      <button role="combobox" aria-label="model-trigger" disabled={state.disabled} {...props} />
    ),
    SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
    SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
    SelectItem: ({ value, children }: any) => (
      <div role="option" aria-label={value} onClick={() => state.onValueChange?.(value)}>
        {children}
      </div>
    ),
  }
})

// Mock Redux hooks: controllable selector state + spy dispatch
const dispatchMock = vi.fn()
type ChatState = { models: string[]; model: string | null }
let mockChat: ChatState

vi.mock("../../hooks", () => ({
  __esModule: true,
  useAppDispatch: () => dispatchMock,
  useAppSelector: (sel: any) => sel({ chat: mockChat }),
}))

import ModelSelect from "../ModelSelect"

describe("ModelSelect", () => {
  beforeEach(() => {
    dispatchMock.mockClear()
    mockChat = { models: ["gpt-4-latest", "gpt-4-mini"], model: "" }
  })

  it("dispatches setModel when an option is chosen", async () => {
    const user = userEvent.setup()
    render(<ModelSelect />)

    // Options are rendered by our mock Select; clicking should call onValueChange
    await user.click(screen.getByRole("option", { name: "gpt-4-latest" }))

    expect(dispatchMock).toHaveBeenCalled()
    const action = dispatchMock.mock.calls[0][0]
    expect(action.type).toMatch(/setModel/i)
    expect(action.payload).toBe("gpt-4-latest")
  })

  it("shows empty state when no models available", () => {
    mockChat = { models: [], model: "" }
    render(<ModelSelect />)
    expect(screen.getByText(/no models available/i)).toBeInTheDocument()
  })

  it("respects disabled prop and disables trigger", () => {
    render(<ModelSelect disabled />)
    const trigger = screen.getByRole("combobox", { name: /model-trigger/i })
    expect(trigger).toBeDisabled()
  })
})
