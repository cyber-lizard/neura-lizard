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
  SidebarRail: (props: any) => <div data-testid="sidebar-rail" {...props} />,
}))

import { Sidebar, type StoredConversation } from "../Sidebar"

describe("Sidebar", () => {
  const onNewChat = vi.fn()
  const onSelect = vi.fn()
  const onDelete = vi.fn()

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
      />
    )

    // Grab all conversation row buttons by their titles
    const second = screen.getByRole("button", { name: /second chat/i })
    const first = screen.getByRole("button", { name: /first chat/i })
    const third = screen.getByRole("button", { name: /third chat/i })

    // Ensure order inside the menu matches: c2 (newest), c1, c3
    const menu = screen.getByTestId("sidebar-menu")
    const items = within(menu).getAllByTestId("sidebar-menu-item")
    const titlesInOrder = items.map((el) => el.textContent || "")

    expect(titlesInOrder.indexOf(second.textContent!)).toBeLessThan(titlesInOrder.indexOf(first.textContent!))
    expect(titlesInOrder.indexOf(first.textContent!)).toBeLessThan(titlesInOrder.indexOf(third.textContent!))
  })

  it("calls onSelect when clicking a conversation", () => {
    render(
      <Sidebar
        conversations={conversations}
        currentId=""
        onNewChat={onNewChat}
        onSelect={onSelect}
        onDelete={onDelete}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: /second chat/i }))
    expect(onSelect).toHaveBeenCalledWith("c2")
  })

  it("calls onDelete when clicking delete button and does not trigger onSelect", () => {
    render(
      <Sidebar
        conversations={conversations}
        currentId=""
        onNewChat={onNewChat}
        onSelect={onSelect}
        onDelete={onDelete}
      />
    )

    // Find the row for "Second chat", then its delete button (with title="Delete")
    const row = screen.getByRole("button", { name: /second chat/i }).closest('[data-testid="sidebar-menu-item"]') as HTMLElement
    expect(row).toBeTruthy()

    const del = within(row).getByTitle("Delete")
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
      />
    )
    const activeBtn = screen.getByRole("button", { name: /first chat/i })
    expect(activeBtn).toHaveClass("bg-sidebar-accent")
  })

  // Footer currently has no content; no test for footer text
})