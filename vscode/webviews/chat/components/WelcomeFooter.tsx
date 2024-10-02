import styles from './WelcomeFooter.module.css'

import {
    AtSignIcon,
    BookOpenText,
    type LucideProps,
    MessageCircleQuestion,
    MessageSquarePlus,
    TextSelect,
} from 'lucide-react'
import type { ForwardRefExoticComponent } from 'react'

interface ChatViewTip {
    message: string
    icon: ForwardRefExoticComponent<Omit<LucideProps, 'ref'>>
}

interface ChatViewLink {
    icon: ForwardRefExoticComponent<Omit<LucideProps, 'ref'>>
    text: string
    url: string
}

const chatTips: ChatViewTip[] = [
    {
        message: 'Type @ to add context to your chat',
        icon: AtSignIcon,
    },
    {
        message: 'Start a new chat using ⌥ / or the New Chat button',
        icon: MessageSquarePlus,
    },
    {
        message: 'To add code context from an editor, right click and use Add to Cody Chat',
        icon: TextSelect,
    },
]

const chatLinks: ChatViewLink[] = [
    {
        icon: BookOpenText,
        text: 'Documentation',
        url: 'https://sourcegraph.com/docs/cody',
    },
    {
        icon: MessageCircleQuestion,
        text: 'Help and Support',
        url: 'https://community.sourcegraph.com/',
    },
]

export default function WelcomeFooter() {
    function tips() {
        return chatTips.map((tip, key) => {
            const Icon = tip.icon
            return (
                <div key={`tip-${key + 1}`} className={styles.item}>
                    <Icon className="tw-w-8 tw-h-8 tw-shrink-0" strokeWidth={1.25} />
                    <div className="tw-text-muted-foreground">{tip.message}</div>
                </div>
            )
        })
    }

    function links() {
        return chatLinks.map((link, key) => {
            const Icon = link.icon
            return (
                <div className={styles.item} key={`link-${key + 1}`}>
                    <Icon className="tw-w-8 tw-h-8" strokeWidth={1.25} />
                    <a href={link.url} rel="noreferrer" target="_blank">
                        {link.text}
                    </a>
                </div>
            )
        })
    }

    return (
        <div className={styles.welcomeFooter}>
            <div className={styles.tips}>{tips()}</div>
            <div className={styles.links}>{links()}</div>
        </div>
    )
}
