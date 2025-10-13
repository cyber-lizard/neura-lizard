import * as React from "react"
import clsx from "clsx"
import { MessageSquare, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sidebar as UISidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

export type ChatMessage = {
  id: string
  role: "user" | "assistant" | "system" | "tool"
  content: string
}
export type StoredConversation = {
  id: string
  title: string
  updatedAt: number
  messages: ChatMessage[]
}

type Props = {
  conversations: StoredConversation[]
  currentId: string
  onNewChat: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

export function Sidebar({
  conversations,
  currentId,
  onNewChat,
  onSelect,
  onDelete,
}: Props) {
  return (
    <UISidebar collapsible="icon">
      <SidebarHeader className="p-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={onNewChat}
        >
          <Plus className="h-4 w-4" />
          New chat
        </Button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>History</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {conversations
                .slice()
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((c) => {
                  const active = c.id === currentId
                  return (
                    <SidebarMenuItem key={c.id}>
                      <SidebarMenuButton
                        className={clsx(
                          "justify-start gap-2",
                          active && "bg-sidebar-accent text-sidebar-accent-foreground"
                        )}
                        onClick={() => onSelect(c.id)}
                      >
                        <MessageSquare className="h-4 w-4" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate">
                            {c.title || "New chat"}
                          </div>
                          <div className="truncate text-xs opacity-60">
                            {new Date(c.updatedAt).toLocaleString()}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-1 h-7 w-7 opacity-70 hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(c.id)
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="text-xs text-muted-foreground">
        Neuralizard
      </SidebarFooter>

      <SidebarRail />
    </UISidebar>
  )
}