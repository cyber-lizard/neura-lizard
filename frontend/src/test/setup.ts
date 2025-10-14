import { expect, afterEach } from "vitest"
import * as matchers from "@testing-library/jest-dom/matchers"
import { cleanup } from "@testing-library/react"

// Add jest-dom matchers to Vitest's expect (works without esModuleInterop)
expect.extend(matchers as any)

// Clean up DOM after each test
afterEach(() => {
  cleanup()
})