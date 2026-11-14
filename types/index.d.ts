// isOnline: working now. isSignedOff: removed with /buddylist clear; until then a
// finished agent stays on the list as idle, since it can be messaged again.
// awayMessage: the first sentence of what the agent last reported, shown as its away message.
export type Buddy = { id: string; name: string; isOnline: boolean; isSignedOff?: boolean; awayMessage?: string }

declare module 'claude-code' {
  interface PluginState {
    'aim-theme': {
      isTyping: boolean
      warning: number
      away: string | null
      idleSince: number | null
      idleMinutes: number
      tzOffsetMinutes: number
      buddies: Buddy[]
      isAimSpeak: boolean
      // The latest buddy alert ("x has signed on."), shown in the IM status strip for a few seconds.
      buddyAlert: string | null
    }
  }
}
