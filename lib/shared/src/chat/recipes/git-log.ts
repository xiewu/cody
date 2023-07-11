import { spawnSync } from 'child_process'
import path from 'path'

import { Editor, uriToPath } from '../../editor'
import { MAX_RECIPE_INPUT_TOKENS } from '../../prompt/constants'
import { truncateText } from '../../prompt/truncation'
import { Interaction } from '../transcript/interaction'

import { Recipe, RecipeContext, RecipeID } from './recipe'

export class GitHistory implements Recipe {
    public id: RecipeID = 'git-history'

    public async getInteraction(_humanChatInput: string, context: RecipeContext): Promise<Interaction | null> {
        const wsRootUri = context.editor.getActiveWorkspace()?.root
        if (!wsRootUri) {
            return Promise.resolve(null)
        }

        const wsRootPath = uriToPath(wsRootUri)!

        const logFormat = '--pretty="Commit author: %an%nCommit message: %s%nChange description:%b%n"'
        const items = [
            {
                label: 'Last 5 items',
                args: ['log', '-n5', logFormat],
                rawDisplayText: 'What changed in my codebase in the last 5 commits?',
            },
            {
                label: 'Last day',
                args: ['log', '--since', '1 day', logFormat],
                rawDisplayText: 'What has changed in my codebase in the last day?',
            },
            {
                label: 'Last week',
                args: ['log', "--since='1 week'", logFormat],
                rawDisplayText: 'What changed in my codebase in the last week?',
            },
        ]

        const active = context.editor.getActiveTextDocument()

        if (active === null) {
            return null
        }

        const fileName = uriToPath(active.uri)!
        const selection = Editor.getTextDocumentSelectionTextOrEntireFile(active)

        if (selection) {
            const name = path.basename(fileName)
            items.push({
                label: `Last 5 items for ${name}`,
                args: ['log', '-n5', logFormat, '--', fileName],
                rawDisplayText: `What changed in ${name} in the last 5 commits`,
            })
        }
        const selectedLabel = await context.editor.quickPick(items.map(e => e.label))
        if (!selectedLabel) {
            return null
        }
        const selected = Object.fromEntries(
            items.map(({ label, args, rawDisplayText }) => [label, { args, rawDisplayText }])
        )[selectedLabel]

        const { args: gitArgs, rawDisplayText } = selected

        const gitLogCommand = spawnSync('git', ['--no-pager', ...gitArgs], { cwd: wsRootPath })
        const gitLogOutput = gitLogCommand.stdout.toString().trim()

        if (!gitLogOutput) {
            const emptyGitLogMessage = 'No recent changes found'
            return new Interaction(
                { speaker: 'human', displayText: rawDisplayText },
                {
                    speaker: 'assistant',
                    prefix: emptyGitLogMessage,
                    text: emptyGitLogMessage,
                },
                Promise.resolve([]),
                []
            )
        }

        const truncatedGitLogOutput = truncateText(gitLogOutput, MAX_RECIPE_INPUT_TOKENS)
        let truncatedLogMessage = ''
        if (truncatedGitLogOutput.length < gitLogOutput.length) {
            truncatedLogMessage = 'Truncated extra long git log output, so summary may be incomplete.'
        }

        const promptMessage = `Summarize these commits:\n${truncatedGitLogOutput}\n\nProvide your response in the form of a bulleted list. Do not mention the commit hashes.`
        const assistantResponsePrefix = `Here is a summary of recent changes:\n${truncatedLogMessage}`
        return new Interaction(
            { speaker: 'human', text: promptMessage, displayText: rawDisplayText },
            {
                speaker: 'assistant',
                prefix: assistantResponsePrefix,
                text: assistantResponsePrefix,
            },
            Promise.resolve([]),
            []
        )
    }
}
