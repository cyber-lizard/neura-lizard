import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"

import Logo from "../Logo"

describe("Logo", () => {
  it("renders with default alt and size", () => {
    render(<Logo />)
    const img = screen.getByAltText(/neuralizard/i)
    expect(img).toBeInTheDocument()
    // md size maps to h-10 w-10
    expect(img).toHaveClass("h-10", "w-10")
  })

  it("wraps image in a link when href is provided", () => {
    render(<Logo href="/" />)
    const link = screen.getByRole("link", { name: /neuralizard/i })
    expect(link).toHaveAttribute("href", "/")
    const img = link.querySelector("img")
    expect(img).not.toBeNull()
  })

  it("applies size and className overrides", () => {
    render(<Logo size="sm" className="rounded" alt="Brand" />)
    const img = screen.getByAltText(/brand/i)
    expect(img).toHaveClass("h-6", "w-6", "rounded")
  })
})
