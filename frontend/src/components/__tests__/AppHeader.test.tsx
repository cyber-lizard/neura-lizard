import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { AppHeader } from "../AppHeader"

// Mock image import (must return an object with default)
vi.mock("@/assets/images/lizard.png", () => ({ default: "lizard.png" }))

// Mock ProviderSelect to simple stub
vi.mock("../ProviderSelect", () => ({
  ProviderSelect: () => <div data-testid="provider-select">ProviderSelect</div>,
}))

// Mock SidebarTrigger from shadcn sidebar
vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: (props: any) => <button data-testid="sidebar-trigger" {...props}>☰</button>,
}))

describe("AppHeader", () => {
  it("renders title, logo, provider select, and sidebar trigger", () => {
    render(<AppHeader wsConnecting={false} wsConnected={false} />)
    expect(screen.getByText(/Neuralizard Chat/i)).toBeInTheDocument()
    expect(screen.getByAltText(/Neuralizard/i)).toBeInTheDocument()
    expect(screen.getByTestId("provider-select")).toBeInTheDocument()
    expect(screen.getByTestId("sidebar-trigger")).toBeInTheDocument()
  })

  it("shows Connecting... when wsConnecting", () => {
    render(<AppHeader wsConnecting={true} wsConnected={false} />)
    expect(screen.getByText(/Connecting.../i)).toBeInTheDocument()
  })

  it("shows Connected when connected", () => {
    render(<AppHeader wsConnecting={false} wsConnected={true} />)
    expect(screen.getByText(/Connected/i)).toBeInTheDocument()
  })

  it("shows Disconnected when neither connecting nor connected", () => {
    render(<AppHeader wsConnecting={false} wsConnected={false} />)
    expect(screen.getByText(/Disconnected/i)).toBeInTheDocument()
  })
})