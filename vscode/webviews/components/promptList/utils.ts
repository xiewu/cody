import type { Action } from '@sourcegraph/cody-shared'

export function commandRowValue(row: Action): string {
    return row.actionType === 'prompt' ? `prompt-${row.id}` : `command-${row.key}`
}

export const shouldShowAction = (action: Action, isEditEnabled: boolean): boolean => {
    const isActionEditLike =
        action.actionType === 'prompt' ? action.mode !== 'CHAT' : action.mode !== 'ask'

    return isEditEnabled || !isActionEditLike
}
