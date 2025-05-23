import type { McpServer } from '@sourcegraph/cody-shared/src/llm-providers/mcp/types'
import { DatabaseBackup, Minus, PencilRulerIcon, Server, ServerIcon, Settings } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getVSCodeAPI } from '../../utils/VSCodeApi'
import { Badge } from '../shadcn/ui/badge'
import { Button } from '../shadcn/ui/button'
import { Command, CommandInput, CommandItem, CommandList } from '../shadcn/ui/command'
import type { ServerType } from './types'
import { AddServerView } from './views/AddServerView'

interface ServerHomeProps {
    mcpServers?: ServerType[]
}

export function ServerHome({ mcpServers }: ServerHomeProps) {
    const [servers, setServers] = useState<ServerType[]>([])
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedServer, setSelectedServer] = useState<ServerType | null>(null)

    // Update servers when mcpServers prop changes
    useEffect(() => {
        if (mcpServers) {
            setServers(mcpServers)
        }
    }, [mcpServers])

    // Handle messages from the extension
    useEffect(() => {
        const messageHandler = (event: MessageEvent) => {
            const message = event.data
            if (message.type !== 'clientAction') return

            // Handle server-specific updates
            if (message.mcpServerChanged?.name) {
                const { name, server } = message.mcpServerChanged
                setServers(prevServers => {
                    // Check if this server already exists in our state
                    if (prevServers.some(s => s.name === name)) {
                        // Update existing server
                        return prevServers.map(s => (s.name === name ? { ...s, ...server } : s))
                    }
                    // Add new server
                    const newServer = {
                        id: `server-${Date.now()}`, // Generate a unique ID
                        name: name,
                        type: server.type || 'Server',
                        status: server.status || 'connecting',
                        ...server,
                    }
                    return [...prevServers, newServer]
                })
            }

            // Handle server error
            if (message.mcpServerError?.name) {
                setServers(prevServers =>
                    prevServers.filter(s => s.name !== message.mcpServerError.name)
                )
            }
        }

        window.addEventListener('message', messageHandler)
        return () => window.removeEventListener('message', messageHandler)
    }, [])

    const removeServer = useCallback((serverName: string) => {
        setSelectedServer(null)
        getVSCodeAPI().postMessage({
            command: 'mcp',
            type: 'removeServer',
            name: serverName,
        })
    }, [])

    const addServer = useCallback(
        (server: ServerType) => {
            // Transform the UI server type to the format expected by MCPManager
            const mcpServerConfig: Record<string, any> = {
                transportType: server.url ? 'sse' : 'stdio',
            }
            // Add URL for SSE transport
            if (server.url) {
                mcpServerConfig.url = server.url
            }
            // Add command and args for stdio transport
            if (server.command) {
                mcpServerConfig.command = server.command
                // Only add non-empty args
                if (server.args?.length) {
                    mcpServerConfig.args = server.args.filter(arg => arg.trim())
                }
            }
            // Add environment variables
            if (server.env?.length) {
                const envVars: Record<string, string> = {}
                for (const env of server.env) {
                    if (env.name.trim()) {
                        envVars[env.name] = env.value
                    }
                }
                if (Object.keys(envVars).length) {
                    mcpServerConfig.env = envVars
                }
            }

            // Check if we're editing an existing server
            if (selectedServer && server.id === selectedServer.id) {
                // If the name hasn't changed, use updateServer instead of addServer
                if (server.name === selectedServer.name) {
                    // Update existing server
                    getVSCodeAPI().postMessage({
                        command: 'mcp',
                        type: 'updateServer',
                        name: server.name,
                        config: mcpServerConfig,
                    })
                } else {
                    // Name changed, need to remove old and add new
                    // Remove old server first
                    removeServer(selectedServer.name)
                    // Then add new server with updated name
                    getVSCodeAPI().postMessage({
                        command: 'mcp',
                        type: 'addServer',
                        name: server.name,
                        config: mcpServerConfig,
                    })
                }
                setSelectedServer(null)
            } else {
                // Add new server
                getVSCodeAPI().postMessage({
                    command: 'mcp',
                    type: 'addServer',
                    name: server.name,
                    config: mcpServerConfig,
                })
            }
        },
        [selectedServer, removeServer]
    )

    const toggleTool = useCallback((serverName: string, toolName: string, isDisabled: boolean) => {
        getVSCodeAPI().postMessage({
            command: 'mcp',
            type: 'updateServer',
            name: serverName,
            toolName,
            toolDisabled: isDisabled,
        })
        // Update local state optimistically
        setServers(prevServers =>
            prevServers.map(server =>
                server.name === serverName
                    ? {
                          ...server,
                          tools: server.tools?.map(tool =>
                              tool.name === toolName ? { ...tool, disabled: isDisabled } : tool
                          ),
                      }
                    : server
            )
        )
    }, [])

    // Filter servers based on search query
    const filteredServers = useMemo(() => {
        return servers.filter(
            server =>
                server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                server.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
                server.tools?.some(tool => tool.name.toLowerCase().includes(searchQuery.toLowerCase()))
        )
    }, [searchQuery, servers])

    return (
        <Command
            loop={true}
            tabIndex={0}
            shouldFilter={false}
            defaultValue="empty"
            className="tw-flex tw-flex-col tw-h-full tw-py-4 tw-bg-transparent tw-px-2 tw-mb-4 tw-overscroll-auto"
            disablePointerSelection={true}
        >
            <header className="tw-flex tw-items-center tw-justify-between tw-mt-4 tw-px-4">
                <div className="tw-flex tw-items-center tw-font-semibold tw-text-lg">
                    <ServerIcon size={16} className="tw-mr-3" /> MCP Servers
                </div>
                <Button
                    variant="ghost"
                    className="tw-h-8 tw-w-auto"
                    onClick={() =>
                        getVSCodeAPI().postMessage({
                            command: 'command',
                            id: 'workbench.action.openSettingsJson',
                            args: {
                                revealSetting: {
                                    key: 'cody.mcpServers',
                                },
                            },
                        })
                    }
                    title="Configure settings in JSON"
                >
                    <Settings size={16} /> View JSON
                </Button>
            </header>
            {!mcpServers?.length ? (
                <div className="tw-w-full tw-col-span-full tw-text-center tw-py-12 tw-border tw-rounded-lg tw-border-none">
                    <Server className="tw-h-12 tw-w-12 tw-mx-auto tw-mb-4 tw-text-muted-foreground" />
                    <h3 className="tw-text-md tw-font-medium">Waiting for server connections...</h3>
                    <p className="tw-text-muted-foreground tw-mt-1">Add a new server to get started</p>
                </div>
            ) : (
                <div>
                    <div className="tw-flex tw-items-center tw-justify-between tw-px-2 tw-py-1">
                        <CommandList className="tw-flex-1">
                            <CommandInput
                                value={searchQuery}
                                onValueChange={setSearchQuery}
                                placeholder="Search..."
                                autoFocus={true}
                                className="tw-m-[0.5rem] !tw-p-[0.5rem] tw-rounded tw-bg-input-background tw-text-input-foreground focus:tw-shadow-[0_0_0_0.125rem_var(--vscode-focusBorder)]"
                            />
                        </CommandList>
                    </div>
                    <CommandList className="tw-flex-1 tw-overflow-y-auto tw-m-2 tw-gap-6 !tw-bg-transparent focus:tw-bg-inherit">
                        {filteredServers.map(server => (
                            <CommandItem
                                key={server.id}
                                className="tw-text-left tw-truncate tw-w-full tw-rounded-md tw-text-sm tw-overflow-hidden tw-text-sidebar-foreground tw-align-baseline hover:tw-bg-transparent [&[aria-selected='true']]:tw-bg-transparent tw-my-2"
                                onSelect={() => setSelectedServer(server)}
                            >
                                <div className="tw-truncate tw-w-full tw-flex tw-flex-col tw-gap-2">
                                    <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
                                        <div className="tw-flex tw-self-end tw-gap-2">
                                            <PencilRulerIcon
                                                className="tw-w-8 tw-h-8"
                                                strokeWidth={1.25}
                                                size={16}
                                            />
                                            <strong>{server.name}</strong>
                                        </div>
                                        {server.name === selectedServer?.name && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="tw-p-2 tw-z-10"
                                                onClick={e => {
                                                    e.stopPropagation()
                                                    removeServer(server.name)
                                                }}
                                                title="Delete server"
                                            >
                                                <Minus size={16} />
                                            </Button>
                                        )}
                                    </div>
                                    <div className="tw-flex tw-align-top tw-justify-between tw-my-1 tw-flex-wrap">
                                        {server.error && (
                                            <div className="tw-mt-2 tw-mb-1 tw-w-full">
                                                <p
                                                    className="tw-text-xs tw-text-pink-300 tw-mt-1 tw-truncate"
                                                    title={server.error}
                                                >
                                                    {server.error}
                                                </p>
                                            </div>
                                        )}
                                        {server.tools && server.tools?.length > 0 && (
                                            <div className="tw-mt-2">
                                                <div className="tw-flex tw-flex-wrap tw-gap-4">
                                                    {server.tools.map(tool => (
                                                        <Badge
                                                            key={`${server.name}-${tool.name}-tool`}
                                                            variant={
                                                                tool.disabled ? 'disabled' : 'outline'
                                                            }
                                                            className={`tw-truncate tw-max-w-[250px] tw-text-foreground tw-cursor-pointer tw-font-thin ${
                                                                tool.disabled
                                                                    ? 'tw-opacity-50 tw-line-through'
                                                                    : ''
                                                            }`}
                                                            onClick={e => {
                                                                e.stopPropagation()
                                                                toggleTool(
                                                                    server.name,
                                                                    tool.name,
                                                                    tool.disabled !== true
                                                                )
                                                            }}
                                                            title={`${
                                                                tool.disabled ? '[Disabled] ' : ''
                                                            } ${tool.description}`}
                                                        >
                                                            {tool.name}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CommandItem>
                        ))}
                        <div className="tw-flex tw-flex-col tw-justify-center tw-mt-4 tw-w-full">
                            <AddServerView
                                onAddServer={addServer}
                                className="tw-my-4 tw-w-full tw-px-2"
                                serverToEdit={selectedServer}
                                setServerToEdit={setSelectedServer}
                            />
                        </div>
                    </CommandList>
                </div>
            )}
        </Command>
    )
}

export function getMcpServerType(server: McpServer): ServerType {
    const base = {
        id: server.name,
        name: server.name,
        tools: server.tools,
        status: server.status === 'connected' ? 'online' : 'offline',
        icon: DatabaseBackup,
        type: 'mcp',
        error: server.error,
    } satisfies ServerType
    try {
        const config = JSON.parse(server.config)
        if (!config) return base
        base.type = config.url ? 'sse' : 'stdio'
        const mcpServerConfig: Record<string, any> = {}
        mcpServerConfig.url = config.url
        mcpServerConfig.command = config.command
        mcpServerConfig.args = config.args

        // Only map env entries if config.env exists
        mcpServerConfig.env = config.env
            ? Object.entries(config.env).map(([key, value]) => ({
                  name: key,
                  value: value,
              }))
            : undefined

        return { ...base, ...mcpServerConfig }
    } catch (error) {
        console.error('Error parsing MCP server config:', error, server.config)
        return base
    }
}
