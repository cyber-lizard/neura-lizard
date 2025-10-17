import { createSlice, PayloadAction } from "@reduxjs/toolkit"

export type HistoryItem = {
  id: string
  title: string
  started_at: string
  updated_at: string
  default_provider: string
  default_model: string | null
  message_count: number
  last_message_preview: string | null
}

export type ChatMessage = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  serverId?: number // DB id set after "done"
}

type ChatState = {
  prompt: string
  provider: string
  model: string | null
  messages: ChatMessage[]
  currentAssistantId: string | null
  streaming: boolean
  wsConnecting: boolean
  wsConnected: boolean
  error: string | null
  providers: string[]
  history: HistoryItem[]
  historyLoaded: boolean
  // NEW: track selected conversation
  currentConversationId: string | null
  // NEW: queue a prompt while creating a conversation
  pendingPrompt: string | null
}

const initialState: ChatState = {
  prompt: "",
  provider: "openai",
  model: null,
  messages: [],
  currentAssistantId: null,
  streaming: false,
  wsConnecting: false,
  wsConnected: false,
  error: null,
  providers: [],
  history: [],
  historyLoaded: false,
  // NEW
  currentConversationId: null,
  // NEW
  pendingPrompt: null,
}

function genId() {
  return Math.random().toString(36).slice(2, 10)
}

const slice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setPrompt(s, a: PayloadAction<string>) { s.prompt = a.payload },
    setProvider(s, a: PayloadAction<string>) { s.provider = a.payload },
    setModel(s, a: PayloadAction<string | null>) { s.model = a.payload },
    clearAll(s) {
      s.prompt = ""
      s.messages = []
      s.error = null
      s.currentAssistantId = null
      s.streaming = false
    },
    setError(s, a: PayloadAction<string | null>) { s.error = a.payload },
    wsConnecting(s) { s.wsConnecting = true; s.wsConnected = false },
    wsOpen(s) { s.wsConnecting = false; s.wsConnected = true },
    wsClosed(s) { s.wsConnecting = false; s.wsConnected = false },
    startStreaming(s) { s.streaming = true },
    stopStreaming(s) { s.streaming = false },
    addUserMessage(s, a: PayloadAction<string>) {
      s.messages.push({ id: genId(), role: "user", content: a.payload })
    },
    startAssistantMessage(s) {
      const id = genId()
      s.currentAssistantId = id
      s.messages.push({ id, role: "assistant", content: "" })
    },
    setAssistantServerId(s, a: PayloadAction<number>) {
      if (!s.currentAssistantId) return
      const m = s.messages.find(m => m.id === s.currentAssistantId && m.role === "assistant")
      if (m) m.serverId = a.payload
    },
    appendAssistantDelta(s, a: PayloadAction<string>) {
      if (!s.currentAssistantId) return
      const m = s.messages.find(m => m.id === s.currentAssistantId)
      if (m) m.content += a.payload
    },
    finalizeAssistant(s) { s.currentAssistantId = null },
    setProviders(s, a: PayloadAction<string[]>) { s.providers = a.payload },
    historyReceived(state, action: PayloadAction<HistoryItem[]>) {
      state.history = action.payload
      state.historyLoaded = true
    },
    // NEW: select conversation id
    setCurrentConversationId(state, action: PayloadAction<string | null>) {
      state.currentConversationId = action.payload
    },
    // NEW: set/clear pending prompt
    setPendingPrompt(state, action: PayloadAction<string | null>) {
      state.pendingPrompt = action.payload
    },
    replaceMessages(state, action: PayloadAction<Array<{ id: number | string; role: ChatMessage["role"]; content: string }>>) {
      state.currentAssistantId = null
      state.streaming = false
      state.messages = action.payload.map(m => ({
        id: String(m.id),
        role: m.role,
        content: m.content,
        serverId: Number(m.id),
      }))
    },
    removeConversationFromHistory(state, action: PayloadAction<string>) {
      state.history = state.history.filter(h => h.id !== action.payload)
    },
    updateConversationTitle(state, action: PayloadAction<{ id: string; title: string }>) {
      const { id, title } = action.payload
      const item = state.history.find(h => h.id === id)
      if (item) item.title = title
    },
  }
})

// Module-level WebSocket (already present)
const WS_URL = (import.meta as any).env.VITE_WS_URL || "ws://localhost:8001/chat/ws"
let activeWS: WebSocket | null = null

// init on page load (only connects & fetches providers)
export const initWebSocket = () => (dispatch: any) => {
  dispatch(connectWS())
}

// Connect (no immediate user prompt unless already present)
export const connectWS = () => (dispatch: any, getState: () => { chat: ChatState }) => {
  const { chat } = getState()
  if (chat.wsConnected || chat.wsConnecting || activeWS) return
  dispatch(wsConnecting())
  const ws = new WebSocket(WS_URL)
  activeWS = ws

  ws.onopen = () => {
    dispatch(wsOpen())
    // Fetch providers
    try { ws.send(JSON.stringify({ type: "providers" })) } catch {}
    // Optionally request history on open:
    // try { ws.send(JSON.stringify({ type: "history", limit: 50, offset: 0 })) } catch {}
    // If a prompt already exists, send it
    const { chat: latest } = getState()
    if (latest.prompt.trim()) dispatch(sendPromptOverWS())
  }

  ws.onmessage = ev => {
    try {
      const msg = JSON.parse(ev.data)
      switch (msg.type) {
        case "info":
          break
        case "providers":
          if (Array.isArray(msg.providers)) {
            dispatch(setProviders(msg.providers))
            const { chat: latest } = getState()
            if (msg.providers.length && !msg.providers.includes(latest.provider)) {
              dispatch(setProvider(msg.providers[0]))
            }
          }
          break
        case "start":
          dispatch(startStreaming())
          dispatch(startAssistantMessage())
          break
        case "delta":
          if (msg.data) dispatch(appendAssistantDelta(msg.data))
          break
        case "done":
          if (msg.message_id !== undefined) {
            const idNum = Number(msg.message_id)
            if (!Number.isNaN(idNum)) {
              dispatch(slice.actions.setAssistantServerId(idNum))
            }
          }
          dispatch(stopStreaming())
          dispatch(finalizeAssistant())
          break
        case "error":
          dispatch(setError(msg.error || "WS error"))
          dispatch(stopStreaming())
          dispatch(finalizeAssistant())
          break
        case "conversation_deleted":
          if (typeof msg.id === "string") {
            dispatch(slice.actions.removeConversationFromHistory(msg.id))
          }
          break
        case "history":
          if (Array.isArray(msg.items)) {
            dispatch(slice.actions.historyReceived(msg.items))
          }
          break
        case "conversation":
          if (Array.isArray(msg.messages)) {
            // Take provider/model from the last message that has them
            const lastWithProv = [...msg.messages].reverse().find((m: any) => m?.provider || m?.model)
            if (lastWithProv?.provider) dispatch(setProvider(String(lastWithProv.provider)))
            if (lastWithProv?.model) dispatch(setModel(String(lastWithProv.model)))

            const mapped = msg.messages.map((m: any) => ({
              id: m.id,
              role: m.role as ChatMessage["role"],
              content: m.content,
            }))
            dispatch(slice.actions.replaceMessages(mapped))
          }
          break
        case "conversation_title":
          if (typeof msg.id === "string" && typeof msg.title === "string") {
            // Use slice.actions directly to avoid missing symbol issues
            dispatch(slice.actions.updateConversationTitle({ id: msg.id, title: msg.title }))
            // Refresh history to ensure sidebar reflects ordering/updated_at
            try { activeWS?.send(JSON.stringify({ type: "history", limit: 50, offset: 0 })) } catch {}
          }
          break
        case "conversation_created":
          if (typeof msg.id === "string") {
            dispatch(slice.actions.setCurrentConversationId(msg.id))
            // Send pending prompt if we queued one during auto-create
            const { chat: latest } = getState()
            if (latest.pendingPrompt && activeWS && activeWS.readyState === WebSocket.OPEN) {
              try {
                activeWS.send(JSON.stringify({
                  type: "prompt",
                  prompt: latest.pendingPrompt,
                  provider: latest.provider,
                  model: latest.model,
                  conversation_id: msg.id,
                }))
              } catch {}
              dispatch(slice.actions.setPendingPrompt(null))
            }
            // Optionally hydrate messages/history
            try { activeWS?.send(JSON.stringify({ type: "conversation", id: msg.id })) } catch {}
            try { activeWS?.send(JSON.stringify({ type: "history", limit: 50, offset: 0 })) } catch {}
          }
          break
        default:
          break
      }
    } catch {
      // ignore non-JSON
    }
  }

  ws.onerror = () => {
    dispatch(setError("WebSocket error"))
    dispatch(stopStreaming())
    dispatch(finalizeAssistant())
  }

  ws.onclose = () => {
    dispatch(wsClosed())
    dispatch(stopStreaming())
    dispatch(finalizeAssistant())
    if (activeWS === ws) activeWS = null
  }
}

// Run chat (connect if needed then send)
export const runChat = () => (dispatch: any, getState: () => { chat: ChatState }) => {
  const { chat } = getState()
  if (!chat.prompt.trim()) return
  if (chat.streaming || chat.wsConnecting) return
  if (chat.wsConnected && activeWS && activeWS.readyState === WebSocket.OPEN) {
    dispatch(sendPromptOverWS())
    return
  }
  dispatch(connectWS())
}

// Thunk: explicitly ask server to create a conversation
export const requestNewConversation = (opts?: { provider?: string; model?: string | null }) =>
  (_dispatch: any, getState: () => { chat: ChatState }) => {
    if (activeWS && activeWS.readyState === WebSocket.OPEN) {
      const { chat } = getState()
      try {
        activeWS.send(JSON.stringify({
          type: "new_chat",
          provider: opts?.provider || chat.provider,
          model: opts?.model ?? chat.model,
        }))
      } catch {}
    }
  }

// Send user prompt
export const sendPromptOverWS = () => (dispatch: any, getState: () => { chat: ChatState }) => {
  const { chat } = getState()
  if (!activeWS || activeWS.readyState !== WebSocket.OPEN) return
  if (!chat.prompt.trim()) return

  // If no conversation is selected, auto-create and queue the prompt
  if (!chat.currentConversationId) {
    const text = chat.prompt
    // Show user message immediately
    dispatch(addUserMessage(text))
    // Queue prompt to be sent once conversation_created arrives
    dispatch(slice.actions.setPendingPrompt(text))
    // Clear input
    dispatch(setPrompt(""))
    try {
      activeWS.send(JSON.stringify({
        type: "new_chat",
        provider: chat.provider,
        model: chat.model,
      }))
      return
    } catch (e: any) {
      // Fall back to previous error behavior
      dispatch(setError(e.message || "Create chat failed"))
      // keep original guard active below
    }
  }

  // Original behavior: require a selected conversation (kept as fallback)
  if (!chat.currentConversationId) {
    dispatch(setError("No conversation selected. Click 'New chat' first."))
    return
  }

  const payload = {
    type: "prompt",
    prompt: chat.prompt,
    provider: chat.provider,
    model: chat.model,
    conversation_id: chat.currentConversationId,
  }
  dispatch(addUserMessage(chat.prompt))
  try { activeWS.send(JSON.stringify(payload)) } catch (e: any) {
    dispatch(setError(e.message || "Send failed"))
    dispatch(stopStreaming()); dispatch(finalizeAssistant())
  }
  dispatch(setPrompt(""))
}

export const stopStreamAction = () => (dispatch: any) => {
  dispatch(stopStreaming())
}

export const disconnectWSAction = () => (dispatch: any) => {
  if (activeWS) {
    try { activeWS.close(1000, "client disconnect") } catch {}
  }
  activeWS = null
  dispatch(stopStreaming())
  dispatch(wsClosed())
  dispatch(finalizeAssistant())
}

export const {
  setPrompt,
  setProvider,
  setModel,
  clearAll,
  setError,
  wsConnecting,
  wsOpen,
  wsClosed,
  startStreaming,
  stopStreaming,
  addUserMessage,
  startAssistantMessage,
  appendAssistantDelta,
  finalizeAssistant,
  setProviders,
  historyReceived,
  setAssistantServerId,
  replaceMessages,
  removeConversationFromHistory,
  updateConversationTitle,
  // NEW export
  setCurrentConversationId,
  // NEW export
  setPendingPrompt,
} = slice.actions

export default slice.reducer

// Thunk: request history over WS (uses module-level socket)
export const requestHistory = ({ limit = 50, offset = 0 }: { limit?: number; offset?: number } = {}) =>
  (_dispatch: any) => {
    if (activeWS && activeWS.readyState === WebSocket.OPEN) {
      try { activeWS.send(JSON.stringify({ type: "history", limit, offset })) } catch {}
    }
  }

// Send simple vote over WS: vote ∈ {-1,0,1}. Optional: add score/label/comment later.
export const sendMessageFeedback = (payload: {
  id: string | number
  vote: -1 | 0 | 1
  score?: number
  label?: string
  comment?: string
}) => (_dispatch: any) => {
  if (activeWS && activeWS.readyState === WebSocket.OPEN) {
    try {
      activeWS.send(
        JSON.stringify({
          type: "rate",
          message_id: payload.id,
          vote: payload.vote,
          ...(payload.score !== undefined ? { score: payload.score } : {}),
          ...(payload.label ? { label: payload.label } : {}),
          ...(payload.comment ? { comment: payload.comment } : {}),
        })
      )
    } catch {}
  }
}

// Thunk: request one conversation’s messages for the sidebar selection
export const requestConversation = (id: string) =>
  (_dispatch: any) => {
    if (activeWS && activeWS.readyState === WebSocket.OPEN) {
      try { activeWS.send(JSON.stringify({ type: "conversation", id })) } catch {}
    }
  }

// Thunk: delete a conversation via WS
export const requestDeleteConversation = (id: string) => (_dispatch: any) => {
  if (activeWS && activeWS.readyState === WebSocket.OPEN) {
    try { activeWS.send(JSON.stringify({ type: "delete_conversation", id })) } catch {}
  }
}