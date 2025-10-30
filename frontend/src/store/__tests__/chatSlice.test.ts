import { configureStore } from "@reduxjs/toolkit"
import reducer, {
  addUserMessage,
  appendAssistantDelta,
  finalizeAssistant,
  replayConversation,
  connectWS,
  setPrompt,
  startAssistantMessage,
  setCurrentConversationId,
  sendPromptOverWS,
  requestNewConversation,
  requestDeleteConversation,
  requestRenameConversation,
  requestHistory,
  requestConversation,
  setProviderAndFetch,
  disconnectWSAction,
} from "../chatSlice"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

class MockWebSocket {
  static OPEN = 1
  url: string
  readyState = MockWebSocket.OPEN
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  send = vi.fn()
  close = vi.fn()
  constructor(url: string) {
    this.url = url
  }
}

function createTestStore() {
  return configureStore({
    reducer: { chat: reducer },
  })
}

function connectFresh(store: ReturnType<typeof createTestStore>) {
  // Ensure module-level activeWS is cleared between tests
  store.dispatch(disconnectWSAction() as any)
  store.dispatch(connectWS())
  wsInstance?.onopen && wsInstance.onopen()
}

// Narrow the global WebSocket type for tests without conflicting with lib.dom
type WebSocketCtor = new (url: string) => any
const originalWS = globalThis.WebSocket as unknown as WebSocketCtor | undefined

let wsInstance: MockWebSocket | null = null

beforeEach(() => {
  wsInstance = null
  class WS extends MockWebSocket {
    constructor(url: string) {
      super(url)
      wsInstance = this
    }
  }
  // Provide a constructor with OPEN static to satisfy comparisons in slice
  vi.stubGlobal("WebSocket", WS as unknown as typeof WebSocket)
})

afterEach(() => {
  if (originalWS) {
    // restore original if present
    // @ts-expect-error restoring test double
    globalThis.WebSocket = originalWS
  }
  vi.unstubAllGlobals()
})

describe("chatSlice reducers", () => {
  it("handles user/assistant message flow", () => {
    const store = createTestStore()
    expect(store.getState().chat.messages).toHaveLength(0)

    store.dispatch(addUserMessage("hello"))
    expect(store.getState().chat.messages).toHaveLength(1)
    expect(store.getState().chat.messages[0]).toMatchObject({ role: "user", content: "hello" })

    store.dispatch(startAssistantMessage())
    store.dispatch(appendAssistantDelta("hi"))
    store.dispatch(appendAssistantDelta(", there"))
    store.dispatch(finalizeAssistant())

    const msgs = store.getState().chat.messages
    expect(msgs).toHaveLength(2)
    expect(msgs[1]).toMatchObject({ role: "assistant", content: "hi, there" })
    expect(store.getState().chat.currentAssistantId).toBeNull()
  })
})

describe("replayConversation", () => {
  it("starts a new chat and replays prompts one by one", () => {
    const store = createTestStore()

    // Seed two user prompts
    store.dispatch(addUserMessage("First"))
    store.dispatch(addUserMessage("Second"))

    // Open a mocked WS connection and simulate onopen
  store.dispatch(connectWS())
    // trigger onopen to mark connected + allow sends
    wsInstance?.onopen && wsInstance.onopen()

    // Start replay
    store.dispatch(replayConversation() as any)

    // After replay starts, the store should have cleared and re-queued first prompt via sendPromptOverWS
    const stateAfter = store.getState().chat
    // First user message should be visible again in the new conversation context
    expect(stateAfter.messages).toHaveLength(1)
    expect(stateAfter.messages[0]).toMatchObject({ role: "user", content: "First" })

  // Should have initiated new chat request over WS (after any provider fetch)
  expect(wsInstance?.send).toHaveBeenCalled()
  const allPayloads = (wsInstance?.send.mock.calls || []).map((c: any[]) => JSON.parse(c[0]))
  const newChatIdx = allPayloads.findIndex((p: any) => p?.type === "new_chat")
  expect(newChatIdx).toBeGreaterThan(-1)

    // Simulate server creating conversation, which should send the pending first prompt
    wsInstance?.onmessage && wsInstance.onmessage({ data: JSON.stringify({ type: "conversation_created", id: "c1" }) })

    // Next WS send should be the prompt for "First"
  const afterCreatePayloads = (wsInstance?.send.mock.calls || []).slice(newChatIdx + 1).map((c: any[]) => JSON.parse(c[0]))
  const firstPromptPayload = afterCreatePayloads.find((p: any) => p?.type === "prompt")
  expect(firstPromptPayload).toBeTruthy()
  expect(firstPromptPayload.prompt).toBe("First")
  expect(firstPromptPayload.conversation_id).toBe("c1")

    // Simulate full assistant roundtrip for first prompt
    wsInstance?.onmessage && wsInstance.onmessage({ data: JSON.stringify({ type: "start" }) })
    wsInstance?.onmessage && wsInstance.onmessage({ data: JSON.stringify({ type: "delta", data: "resp" }) })
    wsInstance?.onmessage && wsInstance.onmessage({ data: JSON.stringify({ type: "done", message_id: 123 }) })

    // After done, replay should auto-queue the second user prompt
    // That should trigger an addUserMessage("Second") and a send("prompt", "Second")
    const stateAfterSecond = store.getState().chat
    const userMsgs = stateAfterSecond.messages.filter(m => m.role === "user")
    expect(userMsgs[userMsgs.length - 1].content).toBe("Second")

    // Last ws send should be the second prompt
  const finalPayloads = (wsInstance?.send.mock.calls || []).map((c: any[]) => JSON.parse(c[0]))
  const lastPromptPayload = [...finalPayloads].reverse().find((p: any) => p?.type === "prompt")
  expect(lastPromptPayload).toBeTruthy()
  expect(lastPromptPayload.prompt).toBe("Second")
  })
})

describe("websocket thunks and reducers", () => {
  it("connectWS sends providers, setProviderAndFetch requests models", () => {
    const store = createTestStore()
    connectFresh(store)

    // First payloads include providers
    const payloads = (wsInstance?.send.mock.calls || []).map((c: any[]) => JSON.parse(c[0]))
    expect(payloads.some((p: any) => p?.type === "providers")).toBe(true)

    // Request models for a provider
    store.dispatch(setProviderAndFetch("mistral") as any)
    const laterPayloads = (wsInstance?.send.mock.calls || []).map((c: any[]) => JSON.parse(c[0]))
    const modelsReq = [...laterPayloads].reverse().find((p: any) => p?.type === "models")
    expect(modelsReq).toMatchObject({ type: "models", provider: "mistral" })
  })

  it("auto-selects first model from models list when none selected", () => {
    const store = createTestStore()
    connectFresh(store)

    wsInstance?.onmessage && wsInstance.onmessage({ data: JSON.stringify({ type: "models", models: ["a", "b"] }) })
    expect(store.getState().chat.model).toBe("a")
  })

  it("sendPromptOverWS with existing conversation sends prompt and appends user message", () => {
    const store = createTestStore()
    connectFresh(store)

    store.dispatch(setCurrentConversationId("c1"))
    store.dispatch(setPrompt("Hello"))
    store.dispatch(sendPromptOverWS() as any)

    // User message added
    const msgs = store.getState().chat.messages
    expect(msgs[msgs.length - 1]).toMatchObject({ role: "user", content: "Hello" })
    // Prompt sent
    const sent = (wsInstance?.send.mock.calls || []).map((c: any[]) => JSON.parse(c[0]))
    const promptPayload = [...sent].reverse().find((p: any) => p?.type === "prompt")
    expect(promptPayload).toMatchObject({ type: "prompt", prompt: "Hello", conversation_id: "c1" })
    // Prompt cleared
    expect(store.getState().chat.prompt).toBe("")
  })

  it("sendPromptOverWS without conversation creates new_chat and sends prompt after conversation_created", () => {
    const store = createTestStore()
    connectFresh(store)

    store.dispatch(setPrompt("Hi"))
    store.dispatch(sendPromptOverWS() as any)
    // new_chat should be among sends
    const firstSends = (wsInstance?.send.mock.calls || []).map((c: any[]) => JSON.parse(c[0]))
    expect(firstSends.some((p: any) => p?.type === "new_chat")).toBe(true)

    // Simulate creation event and verify pending prompt is sent
    wsInstance?.onmessage && wsInstance.onmessage({ data: JSON.stringify({ type: "conversation_created", id: "cX" }) })
    const sends = (wsInstance?.send.mock.calls || []).map((c: any[]) => JSON.parse(c[0]))
    const promptPayload = [...sends].reverse().find((p: any) => p?.type === "prompt")
    expect(promptPayload).toMatchObject({ type: "prompt", prompt: "Hi", conversation_id: "cX" })
  })

  it("requestDeleteConversation, requestRenameConversation, requestHistory, requestConversation send WS messages", () => {
    const store = createTestStore()
    connectFresh(store)

    store.dispatch(requestDeleteConversation("deadbeef") as any)
    store.dispatch(requestRenameConversation("deadbeef", "Title") as any)
    store.dispatch(requestHistory({ limit: 10, offset: 2 }) as any)
    store.dispatch(requestConversation("deadbeef") as any)

    const payloads = (wsInstance?.send.mock.calls || []).map((c: any[]) => JSON.parse(c[0]))
    expect(payloads.some((p: any) => p?.type === "delete_conversation" && p.id === "deadbeef")).toBe(true)
    expect(payloads.some((p: any) => p?.type === "rename_conversation" && p.id === "deadbeef" && p.title === "Title")).toBe(true)
    expect(payloads.some((p: any) => p?.type === "history" && p.limit === 10 && p.offset === 2)).toBe(true)
    expect(payloads.some((p: any) => p?.type === "conversation" && p.id === "deadbeef")).toBe(true)
  })
})
