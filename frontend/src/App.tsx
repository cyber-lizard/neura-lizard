import { ProviderSelect } from "./components/ProviderSelect"
import { Sidebar as ChatSidebar, StoredConversation } from "./components/Sidebar"
import { useAppDispatch, useAppSelector } from "./hooks"
import ChatMessages from "./components/ChatMessages"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  setPrompt,
  runChat,
  stopStreamAction,
  initWebSocket,
  requestHistory,
  requestConversation,
  clearAll,
  requestDeleteConversation,
  setCurrentConversationId,
  requestNewConversation, // add
} from "./store/chatSlice"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import ChatInput from "./components/ChatInput"
import lizardImg from "@/assets/images/lizard.png"

export default function App() {
  const d = useAppDispatch()
  const {
    prompt, messages, streaming, wsConnected, wsConnecting, error, history, historyLoaded, currentConversationId,
  } = useAppSelector(s => s.chat)
  const listRef = useRef<HTMLDivElement | null>(null)

  const conversations = useMemo<StoredConversation[]>(() => {
    return (history || []).map(h => ({
      id: h.id,
      title: h.title || "New chat",
      updatedAt: Date.parse(h.updated_at),
      messages: (h as any).messages
        ? (h as any).messages.map((m: any) => ({ id: String(m.id), role: m.role, content: m.content }))
        : [],
    }))
  }, [history])

  // Disable automatic default-select of most recent; only user actions select/create chats
  const enableAutoSelect = false
  useEffect(() => {
    if (enableAutoSelect && !currentConversationId && historyLoaded && history.length) {
      d(setCurrentConversationId(history[0].id))
    }
  }, [enableAutoSelect, historyLoaded, history, currentConversationId, d])

  const startNewChat = useCallback(() => {
    d(clearAll())
    d(setCurrentConversationId(null))
    d(requestNewConversation()) // create and select on server
  }, [d])

  // Connect WS on mount
  useEffect(() => { d(initWebSocket()) }, [d])

  // Fetch History as soon as WS is connected
  useEffect(() => {
    if (wsConnected) d(requestHistory({ limit: 50, offset: 0 }))
  }, [wsConnected, d])

  useEffect(() => { listRef.current?.scrollTo(0, listRef.current.scrollHeight) }, [messages, streaming])

  const submit = useCallback(() => { d(runChat()) }, [d])

  return (
    <SidebarProvider>
      <ChatSidebar
        conversations={conversations}
        currentId={currentConversationId || ""}
        onNewChat={startNewChat}
        onSelect={(id) => {
          // Explicitly select the clicked conversation
          d(setCurrentConversationId(id))
          d(requestConversation(id))
        }}
        onDelete={(id) => {
          d(requestDeleteConversation(id))
          if (id === currentConversationId) {
            d(setCurrentConversationId(null))
            d(clearAll())
          }
        }}
      />

      {/* Make inset take full width/height */}
      <SidebarInset className="flex min-h-screen w-full flex-col">
        <header className="p-4 border-b flex flex-wrap items-center gap-3">
          <SidebarTrigger className="-ml-1 mr-1 md:hidden" />
          <img src={lizardImg} alt="Neuralizard" className="h-10 w-10" />
          <h1 className="text-xl font-semibold">Neuralizard Chat</h1>
          <span className="text-xs text-neutral-500">
            {wsConnecting ? "Connecting..." : wsConnected ? "Connected" : "Disconnected"}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-xs text-neutral-600">Provider</label>
            <ProviderSelect />
          </div>
        </header>

        <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-50">
          <ChatMessages
            messages={messages as any}
            streaming={streaming}
            error={error}
            innerRef={listRef}
          />
        </div>

        <ChatInput
          value={prompt}
          onChange={(v) => d(setPrompt(v))}
          onSubmit={() => submit()}
          onStop={() => d(stopStreamAction())}
          streaming={streaming}
          wsConnecting={wsConnecting}
          wsConnected={wsConnected}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}