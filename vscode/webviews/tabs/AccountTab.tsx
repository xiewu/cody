import { CodyIDE } from '@sourcegraph/cody-shared'
import { useCallback } from 'react'
import { URI } from 'vscode-uri'
import { ACCOUNT_UPGRADE_URL, ACCOUNT_USAGE_URL } from '../../src/chat/protocol'
import { EndpointSelection } from '../AuthPage'
import { UserAvatar } from '../components/UserAvatar'
import { Button } from '../components/shadcn/ui/button'
import { getVSCodeAPI } from '../utils/VSCodeApi'
import { useConfig, useUserAccountInfo } from '../utils/useConfig'
import { View } from './types'

interface AccountAction {
    text: string
    onClick: () => void
}
interface AccountTabProps {
    setView: (view: View) => void
    endpointHistory: string[]
}

// TODO: Implement the AccountTab component once the design is ready.
export const AccountTab: React.FC<AccountTabProps> = ({ setView, endpointHistory }) => {
    const config = useConfig()
    const userInfo = useUserAccountInfo()
    const { user, isCodyProUser, isDotComUser } = userInfo
    const { displayName, username, primaryEmail, endpoint } = user

    const actions: AccountAction[] = []
    // Create this at the top level to "Rendered more hooks than during previous render" error
    const manageAccountCallback = useCallback(() => {
        if (userInfo.user.username) {
            const uri = URI.parse(ACCOUNT_USAGE_URL.toString()).with({
                query: `cody_client_user=${encodeURIComponent(userInfo.user.username)}`,
            })
            getVSCodeAPI().postMessage({ command: 'links', value: uri.toString() })
        }
    }, [userInfo])

    if (isDotComUser && !isCodyProUser) {
        actions.push({
            text: 'Upgrade',
            onClick: () =>
                getVSCodeAPI().postMessage({ command: 'links', value: ACCOUNT_UPGRADE_URL.toString() }),
        })
    }
    if (isDotComUser) {
        actions.push({
            text: 'Manage Account',
            onClick: manageAccountCallback,
        })
    }
    actions.push({
        text: 'Settings',
        onClick: () =>
            getVSCodeAPI().postMessage({ command: 'command', id: 'cody.status-bar.interacted' }),
    })
    actions.push({
        text: 'Sign Out',
        onClick: () => {
            getVSCodeAPI().postMessage({ command: 'auth', authKind: 'signout' })
            // TODO: Remove when JB moves to agent based auth
            // Set the view to the Chat tab so that if the user signs back in, they will be
            // automatically redirected to the Chat tab, rather than the accounts tab.
            // This is only for JB as the signout call is captured by the extension and not
            // passed through to the agent.
            if (config.clientCapabilities.agentIDE === CodyIDE.JetBrains) {
                setView(View.Chat)
            }
        },
    })

    return (
        <div className="tw-overflow-auto tw-flex-1 tw-flex tw-flex-col tw-items-start tw-w-full tw-px-8 tw-py-6 tw-gap-6">
            <h2>Account</h2>
            <div className="tw-w-full tw-px-8 tw-py-4 tw-flex tw-flex-col tw-gap-4 tw-bg-popover tw-border tw-border-border tw-rounded-lg">
                <div className="tw-flex tw-justify-between tw-w-full tw-border-b tw-border-border tw-shadow-lg tw-shadow-border-500/50 tw-p-4 tw-pb-6">
                    <div className="tw-flex tw-self-stretch tw-flex-col tw-w-full tw-items-center tw-justify-center">
                        <UserAvatar
                            user={user}
                            size={30}
                            className="tw-flex-shrink-0 tw-w-[30px] tw-h-[30px] tw-flex tw-items-center tw-justify-center"
                        />
                        <div className="tw-flex tw-self-stretch tw-flex-col tw-w-full tw-items-center tw-justify-center tw-mt-4">
                            <p className="tw-text-lg tw-font-semibold">{displayName ?? username}</p>
                            <p className="tw-text-sm tw-text-muted-foreground">{primaryEmail}</p>
                        </div>
                    </div>
                </div>
                <div className="tw-grid tw-grid-cols-5 tw-gap-4">
                    <div>Plan:</div>
                    <div className="tw-text-muted-foreground tw-col-span-4">
                        {isDotComUser ? (isCodyProUser ? 'Cody Pro' : 'Cody Free') : 'Enterprise'}
                    </div>
                    <div>Endpoint:</div>
                    <div className="tw-text-muted-foreground tw-col-span-4">
                        <a href={endpoint} target="_blank" rel="noreferrer">
                            {endpoint}
                        </a>
                    </div>
                </div>
            </div>
            {endpointHistory.length > 0 && (
                <div className="tw-w-full tw-bg-popover tw-border tw-border-border">
                    <EndpointSelection authStatus={config.authStatus} endpoints={endpointHistory} />
                </div>
            )}
            {actions.map(a => (
                <Button
                    key={a.text}
                    variant="secondary"
                    className="tw-w-full tw-bg-popover tw-border tw-border-border"
                    onClick={a.onClick}
                    title={a.text}
                >
                    {a.text}
                </Button>
            ))}
        </div>
    )
}
