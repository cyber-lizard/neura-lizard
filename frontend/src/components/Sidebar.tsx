import * as React from "react"
import clsx from "clsx"
import { MessageSquare, Plus, Trash2, MoreVertical, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import bg2 from "@/assets/images/button-bg.png"
import { Input } from "@/components/ui/input"
import {
  Sidebar as UISidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type StoredConversation = {
  id: string
  title: string
  updatedAt: number
}

type Props = {
  conversations: StoredConversation[]
  currentId: string
  onNewChat: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onRename?: (id: string, title: string) => void
}

export function Sidebar({
  conversations,
  currentId,
  onNewChat,
  onSelect,
  onDelete,
  onRename,
}: Props) {
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editValue, setEditValue] = React.useState<string>("")
  const editRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    if (editingId) {
      // Focus next tick to ensure input is in DOM
      const t = setTimeout(() => editRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
  }, [editingId])

  const startInlineRename = (e: React.MouseEvent, c: StoredConversation) => {
    e.stopPropagation(); e.preventDefault()
    setEditingId(c.id)
    setEditValue(c.title || "")
  }

  const cancelInlineRename = () => {
    setEditingId(null)
    setEditValue("")
  }

  const commitInlineRename = (id: string) => {
    const title = editValue.trim()
    if (title && onRename) onRename(id, title)
    cancelInlineRename()
  }

  const doDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); e.preventDefault()
    onDelete(id)
  }
  return (
    <UISidebar collapsible="icon">
      <SidebarHeader className="p-2">
        <Button
          variant="ghost"
          size="sm"
          className="group relative w-full justify-start gap-2 border-0 rounded-lg text-white hover:text-white active:text-white focus:text-white bg-no-repeat bg-center bg-cover transition-all duration-200 focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:outline-none overflow-hidden mt-4"
          onClick={onNewChat}
          style={{
            // Slight dark overlay improves contrast without hiding image
            backgroundImage: `url(${bg2})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* subtle gloss on hover */}
          <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-white/10" />
          <Plus className="h-4 w-4 drop-shadow" strokeWidth={3}/>
          <span className="relative">New chat</span>
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
                      {editingId === c.id ? (
                        <SidebarMenuButton
                          asChild
                          className={clsx(
                            "justify-start gap-2 flex-1",
                            active && "bg-sidebar-accent text-sidebar-accent-foreground"
                          )}
                        >
                          <div className="flex w-full items-center gap-2" onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
                            <MessageSquare className="h-4 w-4" />
                            <div className="min-w-0 flex-1">
                              <Input
                                ref={editRef}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault()
                                    commitInlineRename(c.id)
                                  } else if (e.key === "Escape") {
                                    e.preventDefault()
                                    cancelInlineRename()
                                  }
                                }}
                                onBlur={() => commitInlineRename(c.id)}
                                className="h-7 w-full text-sm"
                                aria-label="Rename conversation"
                              />
                            </div>
                          </div>
                        </SidebarMenuButton>
                      ) : (
                        <SidebarMenuButton
                          className={clsx(
                            "justify-start gap-2 flex-1",
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
                        </SidebarMenuButton>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuAction aria-label="More actions" title="Actions" showOnHover>
                            <MoreVertical className="h-4 w-4 opacity-80" />
                          </SidebarMenuAction>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="right" align="start">
                          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); startInlineRename(e as any, c) }}>
                            <Pencil className="h-4 w-4" />
                            <span>Rename</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); doDelete(e as any, c.id) }} className="text-red-600 focus:text-red-700">
                            <Trash2 className="h-4 w-4" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </SidebarMenuItem>
                  )
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="text-xs text-muted-foreground">
      </SidebarFooter>

      <SidebarRail />
    </UISidebar>
  )
}