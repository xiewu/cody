import detectIndent from 'detect-indent'
import type { TextDocument } from 'vscode'
import * as vscode from 'vscode'

import { addAutocompleteDebugEvent } from '../../../services/open-telemetry/debug-utils'
import { canUsePartialCompletion } from '../../can-use-partial-completion'
import { endsWithBlockStart } from '../../detect-multiline'
import { insertIntoDocContext } from '../../get-current-doc-context'
import { getLastLine, lines } from '../../text-processing'
import { parseAndTruncateCompletion } from '../../text-processing/parse-and-truncate-completion'
import {
    type InlineCompletionItemWithAnalytics,
    processCompletion,
} from '../../text-processing/process-inline-completions'

import { type DocumentContext, getEditorIndentString } from '@sourcegraph/cody-shared'
import { getDynamicMultilineDocContext } from './dynamic-multiline'
import type {
    FetchAndProcessCompletionsParams,
    FetchCompletionResult,
} from './fetch-and-process-completions'

interface HotStreakExtractorParams extends FetchAndProcessCompletionsParams {
    completedCompletion: InlineCompletionItemWithAnalytics
}

export const STOP_REASON_HOT_STREAK = 'cody-hot-streak'

export interface HotStreakExtractor {
    extract(rawCompletion: string, isRequestEnd: boolean): Generator<FetchCompletionResult>
}

export function pressEnterAndGetIndentString(
    insertText: string,
    currentLine: string,
    document: TextDocument
): string {
    const { languageId, uri } = document

    const startsNewBlock = Boolean(endsWithBlockStart(insertText, languageId))
    const newBlockIndent = startsNewBlock
        ? getEditorIndentString(uri, vscode.workspace, vscode.window)
        : ''
    const currentIndentReference = insertText.includes('\n') ? getLastLine(insertText) : currentLine

    return '\n' + detectIndent(currentIndentReference).indent + newBlockIndent
}

/**
 * For a hot streak, we require the completion to be inserted followed by an enter key
 * Enter will usually insert a line break followed by the same indentation that the
 * current line has.
 */
function insertCompletionAndPressEnter(
    docContext: DocumentContext,
    completion: InlineCompletionItemWithAnalytics,
    document: TextDocument
): DocumentContext {
    const { insertText } = completion

    const indentString = pressEnterAndGetIndentString(insertText, docContext.currentLinePrefix, document)
    const insertTextWithPressedEnter = insertText + indentString

    addAutocompleteDebugEvent('insertCompletionAndPressEnter', {
        currentLinePrefix: docContext.currentLinePrefix,
        text: insertTextWithPressedEnter,
    })

    const updatedDocContext = insertIntoDocContext({
        docContext,
        languageId: document.languageId,
        insertText: insertTextWithPressedEnter,
    })

    return updatedDocContext
}

// To reduce the load on the inference providers we limit the hot streak
// generation to a constant number of lines after the initial completion.
const MAX_HOT_STREAK_LINES = vscode.workspace
    .getConfiguration()
    .get<number>('cody.experimental.maxHotStreakLines', 5)

export function createHotStreakExtractor(params: HotStreakExtractorParams): HotStreakExtractor {
    const { completedCompletion, generateOptions, abortController, stageRecorder } = params
    const {
        docContext,
        document,
        document: { languageId },
    } = generateOptions

    let updatedDocContext = insertCompletionAndPressEnter(docContext, completedCompletion, document)

    function* extract(rawCompletion: string, isRequestEnd: boolean): Generator<FetchCompletionResult> {
        while (true) {
            const hotStreakText = rawCompletion.slice(completedCompletion.insertText.length)

            // Trim the hot streak text to remove leading and trailing new lines.
            if (lines(hotStreakText.trim()).length >= MAX_HOT_STREAK_LINES) {
                // Cancel streaming completions if the hot streak is too long.
                abortController.abort()
            }

            const unprocessedCompletion = rawCompletion.slice(
                updatedDocContext.injectedCompletionText?.length || 0
            )

            addAutocompleteDebugEvent('extract start', {
                text: unprocessedCompletion,
            })

            if (unprocessedCompletion.length === 0) {
                return undefined
            }

            const extractCompletion = isRequestEnd ? parseAndTruncateCompletion : canUsePartialCompletion

            const maybeDynamicMultilineDocContext = {
                ...updatedDocContext,
                ...(!updatedDocContext.multilineTrigger
                    ? getDynamicMultilineDocContext({
                          languageId,
                          docContext: updatedDocContext,
                          insertText: unprocessedCompletion,
                      })
                    : {}),
            }

            const completion = extractCompletion(unprocessedCompletion, {
                document,
                docContext: maybeDynamicMultilineDocContext,
            })

            addAutocompleteDebugEvent('attempted to extract completion', {
                previousNonEmptyLine: docContext.prevNonEmptyLine,
                currentLinePrefix: docContext.currentLinePrefix,
                multilineTrigger: maybeDynamicMultilineDocContext.multilineTrigger,
                text: completion?.insertText,
            })

            if (completion && completion.insertText.trim().length > 0) {
                // If the partial completion logic finds a match, extract this as the next hot
                // streak...
                // ... if not and we are processing the last payload, we use the whole remainder for the
                // completion (this means we will parse the last line even when a \n is missing at
                // the end) ...
                const processedCompletion = processCompletion(
                    completion,
                    {
                        document,
                        position: maybeDynamicMultilineDocContext.position,
                        docContext: maybeDynamicMultilineDocContext,
                    },
                    stageRecorder
                )

                yield {
                    docContext: updatedDocContext,
                    completion: {
                        ...processedCompletion,
                        stopReason: STOP_REASON_HOT_STREAK,
                    },
                }

                updatedDocContext = insertCompletionAndPressEnter(
                    updatedDocContext,
                    processedCompletion,
                    document
                )
            } else {
                addAutocompleteDebugEvent('hot-streak extractor stop')
                // ... otherwise we don't have enough in the remaining completion text to generate a full
                // hot-streak completion and yield to wait for the next chunk (or abort).
                return undefined
            }
        }
    }

    return {
        extract,
    }
}
