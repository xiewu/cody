import { type RepoInfo, graphqlClient, isError, logDebug } from '@sourcegraph/cody-shared'
import * as vscode from 'vscode'
import { vscodeGitAPI } from '../repository/git-extension-api'
import { repoNameResolver } from '../repository/repo-name-resolver'
import type { CodebaseRepoIdMapper } from './enterprise-context-factory'
import type { Repo } from './repo-fetcher'

// TODO(dpc): The vscode.git extension has an delay before we can fetch a
// workspace folder's remote. Switch to cody-engine instead of depending on
// vscode.git and this arbitrary delay.
const GIT_REFRESH_DELAY = 2000

// Watches the VSCode workspace roots and maps any it finds to remote repository
// IDs. This depends on the vscode.git extension for mapping git repositories
// to their remotes.
export class WorkspaceRepoMapper implements vscode.Disposable, CodebaseRepoIdMapper {
    private changeEmitter = new vscode.EventEmitter<Repo[]>()
    private disposables: vscode.Disposable[] = [this.changeEmitter]
    // The workspace repos.
    private repos: Repo[] = []
    // A cache of results for non-workspace repos. This caches repos that are
    // not found, as well as repo IDs.
    private nonWorkspaceRepos = new Map<string, string | undefined>()
    private started: Promise<void> | undefined

    public dispose(): void {
        vscode.Disposable.from(...this.disposables).dispose()
        this.disposables = []
    }

    public clientConfigurationDidChange(): void {
        if (this.started) {
            this.started.then(() => this.updateRepos())
        }
    }

    // CodebaseRepoIdMapper implementation.
    public async repoForCodebase(repoName: string): Promise<Repo | undefined> {
        if (!repoName) {
            return
        }
        // Check workspace repository list.
        const item = this.repos.find(item => item.name === repoName)
        if (item) {
            return {
                id: item.id,
                name: item.name,
            }
        }
        // Check cached, non-workspace repository list.
        if (this.nonWorkspaceRepos.has(repoName)) {
            const id = this.nonWorkspaceRepos.get(repoName)
            return id
                ? {
                      id,
                      name: repoName,
                  }
                : undefined
        }
        const result = await graphqlClient.getRepoId(repoName)
        if (isError(result)) {
            throw result
        }
        this.nonWorkspaceRepos.set(repoName, result || undefined)
        return result
            ? {
                  name: repoName,
                  id: result,
              }
            : undefined
    }

    // Fetches the set of repo IDs and starts listening for workspace changes.
    // After this Promise resolves, `workspaceRepoIds` contains the set of
    // repo IDs for the workspace (if any.)
    public async start(): Promise<void> {
        // If are already starting/started, then join that.
        if (this.started) {
            return this.started
        }

        this.started = (async () => {
            try {
                await this.updateRepos()
            } catch (error) {
                // Reset the started property so the next call to start will try again.
                this.started = undefined
                throw error
            }
            vscode.workspace.onDidChangeWorkspaceFolders(
                async () => {
                    logDebug('WorkspaceRepoMapper', 'Workspace folders changed, updating repos')
                    setTimeout(async () => await this.updateRepos(), GIT_REFRESH_DELAY)
                },
                undefined,
                this.disposables
            )
            // TODO: Only works in the VS Code extension where the Git extension is available.
            // https://github.com/sourcegraph/cody/issues/4138
            vscodeGitAPI?.onDidOpenRepository(
                async () => {
                    logDebug('WorkspaceRepoMapper', 'vscode.git repositories changed, updating repos')
                    setTimeout(async () => await this.updateRepos(), GIT_REFRESH_DELAY)
                },
                undefined,
                this.disposables
            )
        })()

        return this.started
    }

    public get workspaceRepos(): Repo[] {
        return [...this.repos]
    }

    public get onChange(): vscode.Event<Repo[]> {
        return this.changeEmitter.event
    }

    // Updates the `workspaceRepos` property and fires the change event.
    private async updateRepos(): Promise<void> {
        try {
            const folders = vscode.workspace.workspaceFolders || []
            logDebug(
                'WorkspaceRepoMapper',
                `Mapping ${folders.length} workspace folders to repos: ${folders
                    .map(f => f.uri.toString())
                    .join()}`
            )
            this.repos = await this.findRepos(folders)
            logDebug(
                'WorkspaceRepoMapper',
                `Mapped workspace folders to repos: ${JSON.stringify(this.repos.map(repo => repo.name))}`
            )
        } catch (error) {
            logDebug('WorkspaceRepoMapper', `Error mapping workspace folders to repo IDs: ${error}`)
            throw error
        }
        this.changeEmitter.fire(this.workspaceRepos)
    }

    // Given a set of workspace folders, looks up their git remotes and finds the related repo IDs,
    // if any.
    private async findRepos(folders: readonly vscode.WorkspaceFolder[]): Promise<Repo[]> {
        const repoInfos = (
            await Promise.all(
                folders.map(folder => {
                    return repoNameResolver.getRepoInfosFromWorkspaceUri(folder.uri)
                })
            )
        ).flat()
        return repoInfos.filter(
            (info): info is Extract<RepoInfo, { type: 'sourcegraph' }> => info.type === 'sourcegraph'
        )
    }
}
