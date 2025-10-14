import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"

// Hoisted mutable chat state for useAppSelector mock
const { mockChatState, setProviderMock } = vi.hoisted(() => ({
  mockChatState: {
    value: {
      provider: "openai",
      providers: ["openai", "anthropic"],
      streaming: false,
      wsConnecting: false,
      wsConnected: true,
    },
  },
  setProviderMock: vi.fn((p: string) => ({ type: "setProvider", payload: p })),
}))

// Mock dispatch
const mockDispatch = vi.fn()

// Mock hooks using the same resolved path as the component (../hooks from src/components)
vi.mock("../../hooks", () => ({
  __esModule: true,
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: any) => selector({ chat: mockChatState.value }),
}))

// Mock chatSlice using the same resolved path as the component (../store/chatSlice from src/components)
vi.mock("../../store/chatSlice", () => ({
  __esModule: true,
  setProvider: setProviderMock,
}))

// Mock shadcn/ui building blocks used by the component
vi.mock("@/components/ui/button", () => ({
  Button: (props: any) => <button {...props} />,
}))
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children }: any) => <div>{children}</div>,
}))
vi.mock("@/components/ui/command", () => ({
  Command: ({ children }: any) => <div>{children}</div>,
  CommandEmpty: ({ children }: any) => <div>{children}</div>,
  CommandGroup: ({ children }: any) => <div>{children}</div>,
  CommandInput: ({ value, onValueChange, placeholder, className }: any) => (
    <input
      aria-label="provider-search"
      value={value}
      placeholder={placeholder}
      className={className}
      onChange={e => onValueChange?.((e.target as HTMLInputElement).value)}
    />
  ),
  CommandItem: ({ value, onSelect, className, children }: any) => (
    <div
      role="option"
      aria-label={value}
      className={className}
      onClick={() => onSelect?.(value)}
    >
      {children}
    </div>
  ),
}))
vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
}))

import ProviderSelect from "../ProviderSelect"

describe("ProviderSelect", () => {
  beforeEach(() => {
    mockDispatch.mockClear()
    setProviderMock.mockClear()
    mockChatState.value = {
      provider: "openai",
      providers: ["openai", "anthropic"],
      streaming: false,
      wsConnecting: false,
      wsConnected: true,
    }
  })

  it("shows current provider on the trigger button", () => {
    render(<ProviderSelect />)
    expect(screen.getByRole("button", { name: /openai/i })).toBeInTheDocument()
  })

  it("filters providers by search input", () => {
    render(<ProviderSelect />)
    const input = screen.getByLabelText("provider-search")
    fireEvent.change(input, { target: { value: "anth" } })

    expect(screen.getByRole("option", { name: "anthropic" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "openai" })).toBeNull()
  })

  it("dispatches setProvider when selecting an item", () => {
    render(<ProviderSelect />)
    fireEvent.click(screen.getByRole("option", { name: "anthropic" }))
    expect(setProviderMock).toHaveBeenCalledWith("anthropic")
    expect(mockDispatch).toHaveBeenCalledWith({ type: "setProvider", payload: "anthropic" })
  })

  it("auto-selects first provider if current is not available", () => {
    mockChatState.value = {
      provider: "unknown",
      providers: ["openai"],
      streaming: false,
      wsConnecting: false,
      wsConnected: true,
    }
    render(<ProviderSelect />)
    expect(setProviderMock).toHaveBeenCalledWith("openai")
    expect(mockDispatch).toHaveBeenCalledWith({ type: "setProvider", payload: "openai" })
  })

  it("shows loading label and disables button while connecting with empty list", () => {
    mockChatState.value = {
      provider: "openai",
      providers: [],
      streaming: false,
      wsConnecting: true,
      wsConnected: false,
    }
    render(<ProviderSelect />)
    const btn = screen.getByRole("button")
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent(/loading/i)
  })

  it("does not show provider options while connecting", () => {
    mockChatState.value = {
      provider: "openai",
      providers: [],
      streaming: false,
      wsConnecting: true,
      wsConnected: false,
    }
    render(<ProviderSelect />)

    expect(screen.queryByRole("option", { name: "openai" })).toBeNull()
    expect(screen.queryByRole("option", { name: "anthropic" })).toBeNull()
  })

  it("re-enables button and shows provider options when connected", () => {
    mockChatState.value = {
      provider: "openai",
      providers: ["openai", "anthropic"],
      streaming: false,
      wsConnecting: false,
      wsConnected: true,
    }
    render(<ProviderSelect />)

    const btn = screen.getByRole("button")
    expect(btn).not.toBeDisabled()
    expect(screen.getByRole("option", { name: "openai" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "anthropic" })).toBeInTheDocument()
  })
})