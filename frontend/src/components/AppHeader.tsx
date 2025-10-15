import React from "react"
import lizardImg from "@/assets/images/lizard.png"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ProviderSelect } from "./ProviderSelect"

type Props = {
  wsConnecting: boolean
  wsConnected: boolean
  showStatus?: boolean
}

export function AppHeader({ wsConnecting, wsConnected, showStatus = false }: Props) {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 border-b bg-white p-4 h-20 flex flex-wrap items-center gap-3">
      <SidebarTrigger className="-ml-1 mr-1 md:hidden" />
      <img src={lizardImg} alt="Neuralizard" className="h-10 w-10" />
      <h1 className="text-xl font-semibold">Neuralizard Chat</h1>
      {showStatus && (
        <span className="block text-xs text-neutral-500">
          {wsConnecting ? "Connecting..." : wsConnected ? "Connected" : "Disconnected"}
        </span>
      )}
      <div className="flex items-center gap-2 ml-auto">
        <label className="text-xs text-neutral-600">Provider</label>
        <ProviderSelect />
      </div>
    </header>
  )
}