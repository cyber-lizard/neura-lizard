import React from "react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ProviderSelect } from "./ProviderSelect"
import Logo from "./Logo"

type Props = {
  wsConnecting: boolean
  wsConnected: boolean
  showStatus?: boolean
}

export function AppHeader({ wsConnecting, wsConnected, showStatus = false }: Props) {
  return (
    <div className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <header className="p-4 h-20 flex flex-wrap items-center gap-3">
        <SidebarTrigger className="-ml-1 mr-1 md:hidden" />
        <Logo size="md" />
        <h1 className="text-xl">neura_lizard</h1>
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
    </div>
  )
}