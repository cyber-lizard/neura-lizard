import * as React from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { useAppDispatch, useAppSelector } from "../hooks"
import { setProvider } from "../store/chatSlice"

// shadcn/ui components (ensure added via: npx shadcn-ui add button popover command scroll-area)
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverTrigger,
  PopoverContent
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem
} from "@/components/ui/command"
import { ScrollArea } from "@/components/ui/scroll-area"

function cn(...cls: (string | undefined | null | false)[]) {
  return cls.filter(Boolean).join(" ")
}

export function ProviderSelect() {
  const dispatch = useAppDispatch()
  const { provider, providers, streaming, wsConnecting, wsConnected } = useAppSelector(s => s.chat)
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const loading = wsConnecting && !providers.length

  const filtered = providers.filter(p =>
    p.toLowerCase().includes(search.toLowerCase())
  )

  const activeProvider = providers.includes(provider)
    ? provider
    : (providers[0] || provider)

  React.useEffect(() => {
    if (activeProvider && activeProvider !== provider) {
      dispatch(setProvider(activeProvider))
    }
  }, [activeProvider]) // eslint-disable-line

  const selectProvider = (p: string) => {
    dispatch(setProvider(p))
    setOpen(false)
    setSearch("")
    // If you want immediate backend notification:
    // try { (window as any)._nl_ws?.send(JSON.stringify({ type: "set_provider", provider: p })) } catch {}
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={streaming || wsConnecting}
          className={cn(
            "h-9 w-52 justify-between font-normal",
            open && "ring-2 ring-offset-1 ring-blue-500/40"
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                wsConnected ? "bg-emerald-500" : "bg-amber-500",
                loading && "animate-pulse"
              )}
            />
            {loading && "Loading providers..."}
            {!loading && (activeProvider || "No providers")}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-60 p-0"
        align="start"
        sideOffset={4}
      >
        <Command
          filter={(value, search) =>
            value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search provider..."
            className="text-sm"
          />
          <CommandEmpty>
            {loading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Fetching…
              </div>
            ) : (
              "No providers found."
            )}
          </CommandEmpty>
          <CommandGroup heading="Providers">
            <ScrollArea className="max-h-56">
              {filtered.map(p => {
                const selected = p === provider
                return (
                  <CommandItem
                    key={p}
                    value={p}
                    onSelect={() => selectProvider(p)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 transition",
                        selected ? "opacity-100 text-blue-600" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{p}</span>
                  </CommandItem>
                )
              })}
            </ScrollArea>
          </CommandGroup>
          {!providers.length && !loading && (
            <div className="px-3 pb-3 pt-2 text-xs text-muted-foreground">
              Add API keys in .env to enable more providers.
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default ProviderSelect