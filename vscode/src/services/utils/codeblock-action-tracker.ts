import * as vscode from 'vscode'

import { ps, telemetryRecorder } from '@sourcegraph/cody-shared'
import { getEditor } from '../../editor/active-editor'

import { executeSmartApply } from '../../edit/smart-apply'
import { countCode, matchCodeSnippets } from './code-count'

/**
 * It tracks the last stored code snippet and metadata like lines, chars, event, source etc.
 * This is used to track acceptance of generated code by Cody for Chat and Commands
 */
let lastStoredCode = {
    code: 'init',
    lineCount: 0,
    charCount: 0,
    eventName: '',
    source: '',
    requestID: '',
}
let insertInProgress = false
let lastClipboardText = ''

/**
 * SourceMetadataMapping is used to map the source to a numerical value, so telemetry can be recorded on `metadata`.
 **/
enum SourceMetadataMapping {
    chat = 1,
}

/**
 * Sets the last stored code snippet and associated metadata.
 *
 * This is used to track code generation events in VS Code.
 */
function setLastStoredCode(
    code: string,
    eventName: string,
    source = 'chat',
    requestID = ''
): {
    code: string
    lineCount: number
    charCount: number
    eventName: string
    source: string
    requestID?: string
} {
    // All non-copy events are considered as insertions since we don't need to listen for paste events
    insertInProgress = !eventName.includes('copy')
    const { lineCount, charCount } = countCode(code)
    const codeCount = { code, lineCount, charCount, eventName, source, requestID }

    lastStoredCode = codeCount

    // Currently supported events are: copy, insert, save
    const op = eventName.includes('copy') ? 'copy' : eventName.startsWith('insert') ? 'insert' : 'save'

    telemetryRecorder.recordEvent(`cody.${eventName}`, 'clicked', {
        metadata: {
            source: SourceMetadataMapping[source as keyof typeof SourceMetadataMapping] || 0, // Use 0 as default if source is not found
            lineCount,
            charCount,
        },
        interactionID: requestID,
        privateMetadata: {
            source,
            op,
        },
    })

    return codeCount
}

async function setLastTextFromClipboard(clipboardText?: string): Promise<void> {
    lastClipboardText = clipboardText || (await vscode.env.clipboard.readText())
}

/**
 * Handles insert event to insert text from code block at cursor position
 * Replace selection if there is one and then log insert event
 * Note: Using workspaceEdit instead of 'editor.action.insertSnippet' as the later reformats the text incorrectly
 */
export async function handleCodeFromInsertAtCursor(text: string): Promise<void> {
    const editor = getEditor()
    const activeEditor = editor.active
    const selectionRange = activeEditor?.selection
    if (!activeEditor || !selectionRange) {
        throw new Error('No editor or selection found to insert text')
    }

    const edit = new vscode.WorkspaceEdit()
    // trimEnd() to remove new line added by Cody
    edit.insert(activeEditor.document.uri, selectionRange.start, `${text}\n`)
    await vscode.workspace.applyEdit(edit)

    // Log insert event
    const op = 'insert'
    const eventName = `${op}Button`
    setLastStoredCode(text, eventName)
}

const SMART_APPLY_DECORATION = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor('editor.wordHighlightTextBackground'),
    borderColor: new vscode.ThemeColor('editor.wordHighlightTextBorder'),
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
})

export async function handleSmartApply(text: string): Promise<void> {
    const editor = getEditor()
    const activeEditor = editor.active
    if (!activeEditor) {
        throw new Error('No editor found to insert text')
    }

    const fullRange = new vscode.Range(0, 0, activeEditor.document.lineCount - 1, 0)
    // Add a decoration to show we're working on the full range of the current file
    activeEditor.setDecorations(SMART_APPLY_DECORATION, [fullRange])

    await executeSmartApply({
        configuration: {
            document: activeEditor.document,
            // test
            instruction: ps`TODO: Implement instruction`,
            model: 'anthropic/claude-3-haiku-20240307',
            replacement: text,
        },
    })

    // Clear the decorartion on finish
    activeEditor.setDecorations(SMART_APPLY_DECORATION, [])
}
/**
 * Handles insert event to insert text from code block to new file
 */
export function handleCodeFromSaveToNewFile(text: string): void {
    const eventName = 'saveButton'
    setLastStoredCode(text, eventName)
}

/**
 * Handles copying code and detecting a paste event.
 */
export async function handleCopiedCode(text: string, isButtonClickEvent: boolean): Promise<void> {
    // If it's a Button event, then the text is already passed in from the whole code block
    const copiedCode = isButtonClickEvent ? text : await vscode.env.clipboard.readText()
    const eventName = isButtonClickEvent ? 'copyButton' : 'keyDown.Copy'
    // Set for tracking
    if (copiedCode) {
        setLastStoredCode(copiedCode, eventName)
    }
}

// For tracking paste events for inline-chat
export async function onTextDocumentChange(newCode: string): Promise<void> {
    const { code, lineCount, charCount, source, requestID } = lastStoredCode

    if (!code) {
        return
    }

    if (insertInProgress) {
        insertInProgress = false
        return
    }

    await setLastTextFromClipboard()

    // the copied code should be the same as the clipboard text
    if (matchCodeSnippets(code, lastClipboardText) && matchCodeSnippets(code, newCode)) {
        const op = 'paste'
        const eventType = 'keyDown'

        telemetryRecorder.recordEvent(`cody.${eventType}`, 'paste', {
            metadata: {
                lineCount,
                charCount,
                source: SourceMetadataMapping[source as keyof typeof SourceMetadataMapping] || 0, // Use 0 as default if source is not found
            },
            interactionID: requestID,
            privateMetadata: {
                source,
                op,
            },
        })
    }
}
