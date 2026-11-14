// isOnline: working now. isSignedOff: removed with /buddylist clear; until then a
// finished agent stays on the list as idle, since it can be messaged again.
export type Buddy = { id: string; name: string; isOnline: boolean; isSignedOff?: boolean }

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
    }
  }
}
