/* eslint-disable @typescript-eslint/consistent-type-definitions */
import { ContextFile, PreciseContext } from '@sourcegraph/cody-shared'
import { Brand } from '@sourcegraph/cody-shared/src/brand'
import { RecipeID } from '@sourcegraph/cody-shared/src/chat/recipes/recipe'
import { Transcript } from '@sourcegraph/cody-shared/src/chat/transcript'
import { ChatMessage } from '@sourcegraph/cody-shared/src/chat/transcript/messages'
import { event } from '@sourcegraph/cody-shared/src/sourcegraph-api/graphql/client'

import { CompletionEvent } from '../../vscode/src/completions/logger'

// This file documents the Cody Agent JSON-RPC protocol. Consult the JSON-RPC
// specification to learn about how JSON-RPC works https://www.jsonrpc.org/specification
// The Cody Agent server only supports transport via stdout/stdin.

// The JSON-RPC requests of the Cody Agent protocol. Requests are async
// functions that return some (possibly null) value.
export type Requests = {
    // ================
    // Client -> Server
    // ================

    // The 'initialize' request must be sent at the start of the connection
    // before any other request/notification is sent.
    initialize: [ClientInfo, ServerInfo]
    // The 'shutdown' request must be sent before terminating the agent process.
    shutdown: [null, null]

    // Client requests the agent server to lists all recipes that are supported
    // by the agent.
    'recipes/list': [null, RecipeInfo[]]

    // Client requests the agent server to execute an individual recipe.
    // The response is null because the AI/Assistant messages are streamed through
    // the chat/updateMessageInProgress notification. The flow to trigger a recipe
    // is like this:
    // client --- recipes/execute --> server
    // client <-- chat/updateMessageInProgress --- server
    //             ....
    // client <-- chat/updateMessageInProgress --- server
    'recipes/execute': [ExecuteRecipeParams, null]

    // Request a list of autocomplete candidates.
    'autocomplete/execute': [AutocompleteParams, AutocompleteResult]

    'graphql/currentUserId': [null, string]
    'graphql/logEvent': [event, null]

    // Create a new chat
    'chat/new': [ChatNewParams, ChatNewResult]

    // List available chats
    'chat/list': [null, ChatListResult]

    // Send a new message
    'chat/submit': [ChatSubmitParams, ChatSubmitResult]

    // Get a transcript
    'chat/view': [ChatViewParams, ChatViewResult]

    // POTENTIAL FUTURE CHAT MESSAGES:
    // Edit an existing message
    // 'chat/edit': [ChatEditParams, ChatEditResult]

    // Share a chat snippet with someone
    // 'chat/share': []

    // ================
    // Server -> Client
    // ================
}

export type TranscriptID = Brand<string, 'TranscriptID'>

export interface ChatNewParams {}

export interface ChatNewResult {
    newTranscriptID: TranscriptID
}

export interface ChatSubmitParams {
    transcriptID: TranscriptID
    humanInput: string
}

export interface ChatSubmitResult {}

export interface ChatViewParams {
    transcriptID: TranscriptID
}

export interface ChatViewResult {
    transcriptID: TranscriptID
    messages: ChatMessage[]
}

export interface ChatListResult {
    transcripts: { transcriptID: TranscriptID; title: string }[]
}

// The JSON-RPC notifications of the Cody Agent protocol. Notifications are
// synchronous fire-and-forget messages that have no return value. Notifications are
// conventionally used to represent streams of values.
export type Notifications = {
    //{{{
    // ================
    // Client -> Server
    // ================

    // The 'initalized' notification must be sent after receiving the 'initialize' response.
    initialized: [null]
    // The 'exit' notification must be sent after the client receives the 'shutdown' response.
    exit: [null]

    // The server should use the provided extension configuration for all
    // subsequent requests/notifications. The previous extension configuration
    // should no longer be used.
    // This notification is functionally equivalent to extensionConfiguration/didChange
    // and exists to match the previous naming of configuration
    'connectionConfiguration/didChange': [ExtensionConfiguration]

    // The server should use the provided connection configuration for all
    // subsequent requests/notifications. The previous extension configuration
    // should no longer be used.
    // This notification is functionally equivalent to connectionConfiguration/didChange
    // and provided to match the updated configuration naming
    'extensionConfiguration/didChange': [ExtensionConfiguration]

    // Lifecycle notifications for the client to notify the server about text
    // contents of documents and to notify which document is currently focused.
    'textDocument/didOpen': [TextDocument]
    // The 'textDocument/didChange' notification should be sent on almost every
    // keystroke, whether the text contents changed or the cursor/selection
    // changed.  Leave the `content` property undefined when the document's
    // content is unchanged.
    'textDocument/didChange': [TextDocument]
    // The user focused on a document without changing the document's content.
    // Only the 'uri' property is required, other properties are ignored.
    'textDocument/didFocus': [TextDocument]
    // The user closed the editor tab for the given document.
    // Only the 'uri' property is required, other properties are ignored.
    'textDocument/didClose': [TextDocument]

    '$/cancelRequest': [CancelParams]
    // The user no longer wishes to consider the last autocomplete candidate
    // and the current autocomplete id should not be reused.
    'autocomplete/clearLastCandidate': [null]

    // ================
    // Server -> Client
    // ================
    // The server received new messages for the ongoing 'chat/executeRecipe'
    // request. The server should never send this notification outside of a
    // 'chat/executeRecipe' request.
    'chat/updateMessageInProgress': [ChatMessage | null]

    // The server received new messages for the ongoing 'chat/executeRecipe'
    // request. The server should never send this notification outside of a
    // 'chat/executeRecipe' request.
    'chat/update': [ChatMessageUpdate | null]

    'debug/message': [DebugMessage]
} //}}}

export interface CancelParams {
    id: string | number
}

export interface ChatParams {
    id: string

    // List of interactions
    // Q: Why do interactions seem to only have one human message and one assistant?
    //  Do we have a different type for a list of messages?
    // interactions: Interaction[]
}

export interface ChatResult {
    chat_id: string
}

export interface ChatExecuteParams {
    id: string
    content: string
}

export interface ChatExecuteResult {
    chat_id: string
    message_id: string
}

export interface ChatMessageUpdate {
    transcriptID: TranscriptID
    message: ChatMessage
}

export interface AutocompleteParams {
    filePath: string
    position: Position
}

export interface AutocompleteResult {
    items: AutocompleteItem[]
    completionEvent?: CompletionEvent
}

export interface AutocompleteItem {
    insertText: string
    range: Range
}

export interface ClientInfo {
    name: string
    version: string
    workspaceRootUri: string

    /** @deprecated Use `workspaceRootUri` instead. */
    workspaceRootPath?: string

    /** @deprecated Use `extensionConfiguration` instead. */
    connectionConfiguration?: ExtensionConfiguration
    extensionConfiguration?: ExtensionConfiguration
    capabilities?: ClientCapabilities
}

export interface ClientCapabilities {
    completions?: 'none'
    //  When 'streaming', handles 'chat/updateMessageInProgress' streaming notifications.
    chat?: 'none' | 'streaming'
}

export interface ServerInfo {
    name: string
    authenticated: boolean
    codyEnabled: boolean
    codyVersion: string | null
    capabilities?: ServerCapabilities
}
export interface ServerCapabilities {}

export interface ExtensionConfiguration {
    serverEndpoint: string
    proxy?: string | null
    accessToken: string
    customHeaders: Record<string, string>
    autocompleteAdvancedProvider?: string
    autocompleteAdvancedServerEndpoint?: string | null
    autocompleteAdvancedModel?: string | null
    autocompleteAdvancedAccessToken?: string | null
    autocompleteAdvancedEmbeddings?: boolean
    debug?: boolean
    verboseDebug?: boolean
    codebase?: string
}

export interface Position {
    // 0-indexed
    line: number
    // 0-indexed
    character: number
}

export interface Range {
    start: Position
    end: Position
}

export interface TextDocument {
    filePath: string
    content?: string
    selection?: Range
}

export interface RecipeInfo {
    id: RecipeID
    title: string // Title Case
}

export interface ExecuteRecipeParams {
    id: RecipeID
    humanChatInput: string
    data?: any
}

export interface DebugMessage {
    channel: string
    message: string
}
