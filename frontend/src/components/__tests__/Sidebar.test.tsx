import React from "react"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock shadcn/ui building blocks used by Sidebar
vi.mock("@/components/ui/button", () => ({
  Button: (props: any) => <button {...props} />,
}))
vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children, ...rest }: any) => <div data-testid="sidebar-root" {...rest}>{children}</div>,
  SidebarContent: ({ children, ...rest }: any) => <div data-testid="sidebar-content" {...rest}>{children}</div>,
  SidebarFooter: ({ children, ...rest }: any) => <div data-testid="sidebar-footer" {...rest}>{children}</div>,
  SidebarGroup: ({ children, ...rest }: any) => <div data-testid="sidebar-group" {...rest}>{children}</div>,
  SidebarGroupContent: ({ children, ...rest }: any) => <div data-testid="sidebar-group-content" {...rest}>{children}</div>,
  SidebarGroupLabel: ({ children, ...rest }: any) => <div data-testid="sidebar-group-label" {...rest}>{children}</div>,
  SidebarHeader: ({ children, ...rest }: any) => <div data-testid="sidebar-header" {...rest}>{children}</div>,
  SidebarMenu: ({ children, ...rest }: any) => <div data-testid="sidebar-menu" {...rest}>{children}</div>,
  SidebarMenuItem: ({ children, ...rest }: any) => <div data-testid="sidebar-menu-item" {...rest}>{children}</div>,
  SidebarMenuButton: ({ children, className, onClick, ...rest }: any) => (
    <button type="button" className={className} onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  SidebarMenuAction: ({ children, ...rest }: any) => (
    <button aria-label="More actions" {...rest}>{children}</button>
  ),
  SidebarRail: (props: any) => <div data-testid="sidebar-rail" {...props} />,
}))

// Mock dropdown menu primitives with simple DOM equivalents
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children, ...rest }: any) => <div role="menu" {...rest}>{children}</div>,
  DropdownMenuItem: ({ children, onSelect, onClick }: any) => (
    <button role="menuitem" onClick={onClick || onSelect}>{children}</button>
  ),
}))

import { Sidebar, type StoredConversation } from "../Sidebar"

describe("Sidebar", () => {
  const onNewChat = vi.fn()
  const onSelect = vi.fn()
  const onDelete = vi.fn()
  const onRename = vi.fn()

  const conversations: StoredConversation[] = [
    {
      id: "c1",
      title: "First chat",
      updatedAt: new Date("2024-01-01T10:00:00Z").getTime(),
    },
    {
      id: "c2",
      title: "Second chat",
      updatedAt: new Date("2024-02-01T10:00:00Z").getTime(),
    },
    {
      id: "c3",
      title: "Third chat",
      updatedAt: new Date("2023-12-01T10:00:00Z").getTime(),
    },
  ]

  beforeEach(() => {
    onNewChat.mockClear()
    onSelect.mockClear()
    onDelete.mockClear()
  })

  it("renders New chat button and calls onNewChat", () => {
    render(
      <Sidebar
        conversations={[]}
        currentId=""
        onNewChat={onNewChat}
        onSelect={onSelect}
        onDelete={onDelete}
        onRename={onRename}
      />
    )
    const btn = screen.getByRole("button", { name: /new chat/i })
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(onNewChat).toHaveBeenCalledTimes(1)
  })

  it("renders conversations sorted by updatedAt desc", () => {
    render(
      <Sidebar
        conversations={conversations}
        currentId=""
        onNewChat={onNewChat}
        onSelect={onSelect}
        onDelete={onDelete}
        onRename={onRename}
      />
    )
    const menu = screen.getByTestId("sidebar-menu")
    const items = within(menu).getAllByTestId("sidebar-menu-item")

    // Ensure order: c2 (newest), c1, c3
    expect(within(items[0]).getByRole("button", { name: /second chat/i })).toBeInTheDocument()
    expect(within(items[1]).getByRole("button", { name: /first chat/i })).toBeInTheDocument()
    expect(within(items[2]).getByRole("button", { name: /third chat/i })).toBeInTheDocument()
  })

  it("calls onSelect when clicking a conversation", () => {
    render(
      <Sidebar
        conversations={conversations}
        currentId=""
        onNewChat={onNewChat}
        onSelect={onSelect}
        onDelete={onDelete}
        onRename={onRename}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /second chat/i }))
    expect(onSelect).toHaveBeenCalledWith("c2")
  })

  it("calls onDelete from the actions menu and does not trigger onSelect", () => {
    render(
      <Sidebar
        conversations={conversations}
        currentId=""
        onNewChat={onNewChat}
        onSelect={onSelect}
        onDelete={onDelete}
        onRename={onRename}
      />
    )

    // Find the row for "Second chat" and open its actions menu
    const row = screen.getByRole("button", { name: /second chat/i }).closest('[data-testid="sidebar-menu-item"]') as HTMLElement
    expect(row).toBeTruthy()
    const actions = within(row).getByLabelText(/more actions/i)
    fireEvent.click(actions)

    // Click Delete inside the opened menu
    const del = within(row).getByRole("menuitem", { name: /delete/i })
    fireEvent.click(del)

    expect(onDelete).toHaveBeenCalledWith("c2")
    expect(onSelect).not.toHaveBeenCalled()
  })

  it("applies active styling to the selected conversation", () => {
    render(
      <Sidebar
        conversations={conversations}
        currentId="c1"
        onNewChat={onNewChat}
        onSelect={onSelect}
        onDelete={onDelete}
        onRename={onRename}
      />
    )
    const activeBtn = screen.getByRole("button", { name: /first chat/i })
    expect(activeBtn).toHaveClass("bg-sidebar-accent")
  })

  it("renames a conversation inline via the actions menu and calls onRename", () => {
    render(
      <Sidebar
        conversations={conversations}
        currentId=""
        onNewChat={onNewChat}
        onSelect={onSelect}
        onDelete={onDelete}
        onRename={onRename}
      />
    )

    const row = screen.getByRole("button", { name: /second chat/i }).closest('[data-testid="sidebar-menu-item"]') as HTMLElement
    const actions = within(row).getByLabelText(/more actions/i)
    fireEvent.click(actions)

    const rename = within(row).getByRole("menuitem", { name: /rename/i })
    fireEvent.click(rename)

    // Should render an input in place; change value and press Enter
    const input = within(row).getByRole("textbox", { name: /rename conversation/i }) as HTMLInputElement
    // simulate user replacing text
    fireEvent.change(input, { target: { value: "Renamed chat" } })
    fireEvent.keyDown(input, { key: "Enter" })

    expect(onRename).toHaveBeenCalledWith("c2", "Renamed chat")
    expect(onSelect).not.toHaveBeenCalled()
  })

  // Footer currently has no content; no test for footer text
})