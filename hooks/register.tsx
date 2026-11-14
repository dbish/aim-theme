import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeSetArgs, Timer } from 'claude-code'

import type { Buddy } from '../types'
import { makeColors } from './make-colors.js'

// Change these to taste: your screen name and Claude's.
const MY_NAME = 'sk8rboi2000'
const BUDDY_NAME = 'claudeBot98'

// The IM window's own colors.
const RED = '#e00000'
const BLUE = '#0000e0'
const NAVY = '#0a246a'
const GRAY = '#808080'
const CHROME = '#d4d0c8'

const PANE = 'aim-buddy-list'

const isTyping = atom({ plugin: 'aim-theme', key: 'isTyping' } as const, false)
const warning = atom({ plugin: 'aim-theme', key: 'warning' } as const, 0)
const away = atom({ plugin: 'aim-theme', key: 'away' } as const, null)
const idleSince = atom({ plugin: 'aim-theme', key: 'idleSince' } as const, null)
const idleMinutes = atom({ plugin: 'aim-theme', key: 'idleMinutes' } as const, 0)
const tzOffset = atom({ plugin: 'aim-theme', key: 'tzOffsetMinutes' } as const, 0)
const buddies = atom({ plugin: 'aim-theme', key: 'buddies' } as const, [])
const isAimSpeak = atom({ plugin: 'aim-theme', key: 'isAimSpeak' } as const, false)

// AIM was a light-mode program, so this look is light only.
const { theme, problems } = makeColors({
  label: 'Instant Message',
  only: 'light',
  roles: { accent: NAVY, danger: '#c00000', success: '#007a00', warning: '#8a6a00', pro: '#800080' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#f2f1ea',
        'surface-1': '#f8f7f2',
        'surface-2': '#ffffff',
        'surface-3': '#ffffff',
        'text-primary': '#000000',
        'text-secondary': '#1c1c1c',
        'text-muted': '#4a4a4a',
      },
    },
  },
})

const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: 'buddy-list', glass: { blur: 8, tint: '#ffffff', opacity: 0.9 } },
}

const AIM_SPEAK_ON = `The user turned on "AIM speak". Until told it is off, write your prose replies like a teenager on AOL Instant Messenger in 1999: mostly lowercase, short lines, casual abbreviations (lol, brb, omg, thx, np, ttyl), the occasional ~*sparkle*~ or :-) emoticon. Keep it readable and keep every technical fact exactly right. Code blocks, commands, file paths and tool inputs stay completely normal.`
const AIM_SPEAK_OFF = `The user turned "AIM speak" off. Go back to writing replies in your normal style.`

// --- helpers ---------------------------------------------------------------

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

const baseName = (path: unknown) => (typeof path === 'string' ? (path.split('/').pop() ?? path) : 'a file')

const formatTime = (ms: number, offsetMinutes: number) => {
  const d = new Date(ms + offsetMinutes * 60_000)
  const h = d.getUTCHours()
  const pad = (n: number) => String(n).padStart(2, '0')

  return `${h % 12 === 0 ? 12 : h % 12}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} ${h < 12 ? 'AM' : 'PM'}`
}

// An agent's screen name, from the first words of its task.
const screenNameFor = (description: unknown) => {
  const text = typeof description === 'string' ? description : ''
  const stem =
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .join('_') || 'agent'
  let hash = 0

  for (const ch of text) {
    hash = (hash * 31 + ch.charCodeAt(0)) % 100
  }

  return clip(`${stem}${String(hash).padStart(2, '0')}`, 18)
}

// What the IM window would have said about each tool call.
const toolLine = (tool: string, input: Record<string, unknown>, isDone: boolean) => {
  switch (tool) {
    case 'Write':
      return isDone
        ? `File transfer complete: ${baseName(input.file_path)}`
        : `${BUDDY_NAME} is sending you a file: ${baseName(input.file_path)}`
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return isDone
        ? `${BUDDY_NAME} updated ${baseName(input.file_path ?? input.notebook_path)}`
        : `${BUDDY_NAME} is editing ${baseName(input.file_path ?? input.notebook_path)}...`
    case 'Read':
      return `${BUDDY_NAME} is checking out ${baseName(input.file_path)}`
    case 'Bash':
      return `${BUDDY_NAME} is running a program: ${clip(String(input.description ?? input.command ?? ''), 60)}`
    case 'Grep':
    case 'Glob':
      return `${BUDDY_NAME} is searching for "${clip(String(input.pattern ?? ''), 40)}"`
    case 'WebSearch':
    case 'WebFetch':
      return `${BUDDY_NAME} is surfing the web: ${clip(String(input.query ?? input.url ?? ''), 50)}`
    case 'Agent':
    case 'Task':
      return `${screenNameFor(input.description)} has signed ${isDone ? 'off' : 'on'}.`
    default:
      return isDone ? `${BUDDY_NAME} has accepted your request (${tool})` : `${BUDDY_NAME} sent a request: ${tool}`
  }
}

const sceneSvg = (awayText: string | null) => {
  const buddy = (y: number, name: string, cls = '') => `<text x="34" y="${y}" class="b ${cls}">${escapeXml(name)}</text>`
  const bubbleTitle = awayText === null ? 'Away Message:' : `${MY_NAME} is away:`
  const bubbleBody = escapeXml(clip(awayText ?? 'brb, compiling ~*~', 30))

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>
  .b{font:13px Tahoma,Verdana,sans-serif;fill:#000}
  .t{font:bold 12px Tahoma,Verdana,sans-serif;fill:#fff}
  .g{font:bold 13px Tahoma,Verdana,sans-serif;fill:#000}
  .on{animation:on 9s infinite}
  .off{animation:off 13s infinite}
  .away{fill:#808080;font-style:italic}
  @keyframes on{0%,40%{opacity:0}45%,100%{opacity:1}}
  @keyframes off{0%,60%{opacity:1}70%,100%{opacity:.25}}
  .spark{animation:tw 4s ease-in-out infinite}
  .s2{animation-delay:1.3s}.s3{animation-delay:2.6s}
  @keyframes tw{0%,100%{opacity:.15}50%{opacity:.9}}
  .bub{animation:bob 6s ease-in-out infinite}
  @keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
</style>
<defs>
  <linearGradient id="desk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#008080"/><stop offset="1" stop-color="#005f6b"/></linearGradient>
  <linearGradient id="title" x1="0" x2="1"><stop offset="0" stop-color="#000080"/><stop offset="1" stop-color="#1084d0"/></linearGradient>
</defs>
<rect fill="url(#desk)" width="1600" height="1000"/>
<g fill="#ffcc00">
  <path class="spark" d="M200 160l6 18 18 6-18 6-6 18-6-18-18-6 18-6z"/>
  <path class="spark s2" d="M1300 820l4 12 12 4-12 4-4 12-4-12-12-4 12-4z"/>
  <path class="spark s3" d="M120 700l5 15 15 5-15 5-5 15-5-15-15-5 15-5z"/>
</g>
<svg x="0" y="0" width="1600" height="1000" viewBox="0 0 260 520" preserveAspectRatio="xMaxYMin meet">
  <g transform="translate(14 14)">
    <rect width="232" height="440" fill="#c0c0c0" stroke="#000"/>
    <path d="M1 439V1h230" stroke="#fff" fill="none"/>
    <rect x="3" y="3" width="226" height="20" fill="url(#title)"/>
    <text x="9" y="17" class="t">${MY_NAME}'s Buddy List</text>
    <g transform="translate(190 6)">
      ${[0, 1, 2].map(i => `<rect x="${i * 13}" width="12" height="13" fill="#c0c0c0" stroke="#000" stroke-width=".6"/>`).join('')}
      <path d="M28 4l5 5M33 4l-5 5" stroke="#000" stroke-width="1.4"/>
    </g>
    <rect x="8" y="30" width="216" height="58" fill="#ffcc00" stroke="#808080"/>
    <text x="116" y="55" text-anchor="middle" class="g" font-size="18">Buddy</text>
    <text x="116" y="76" text-anchor="middle" class="b">online since 1997</text>
    <rect x="8" y="96" width="216" height="290" fill="#fff" stroke="#808080"/>
    <text x="16" y="116" class="g">▾ Buddies (4/9)</text>
    ${buddy(136, BUDDY_NAME, 'on')}
    ${buddy(154, 'xXglitterXx', 'off')}
    ${buddy(172, 'dialupdreams')}
    ${buddy(190, 'm0dem_screech')}
    <text x="16" y="216" class="g">▾ Family (2/4)</text>
    ${buddy(236, 'momz_online')}
    ${buddy(254, 'LilBroGamez', 'away')}
    <text x="16" y="280" class="g">▾ Co-Workers (1/6)</text>
    ${buddy(300, 'TPSreportz')}
    <text x="16" y="326" class="g">▸ Offline (12)</text>
    <g transform="translate(8 396)">
      ${['IM', 'Chat', 'Info', 'Away'].map((l, i) => `<g transform="translate(${i * 54} 0)"><rect width="50" height="34" fill="#c0c0c0" stroke="#000" stroke-width=".6"/><path d="M1 33V1h48" stroke="#fff" fill="none"/><text x="25" y="22" text-anchor="middle" class="b" font-size="11">${l}</text></g>`).join('')}
    </g>
  </g>
</svg>
<svg x="0" y="0" width="1600" height="1000" viewBox="0 0 300 300" preserveAspectRatio="xMinYMin meet">
  <g class="bub" transform="translate(16 20)">
    <rect width="170" height="54" rx="4" fill="#ffffe1" stroke="#000" stroke-width=".8"/>
    <path d="M22 54l-6 14 18-14z" fill="#ffffe1" stroke="#000" stroke-width=".8"/>
    <text x="10" y="20" class="b" font-size="11" font-weight="bold">${escapeXml(bubbleTitle)}</text>
    <text x="10" y="38" class="b" font-size="11">${bubbleBody}</text>
  </g>
</svg>
</svg>`
}

const isGraphical = (surface: string) => surface === 'desktop' || surface === 'mobile'

const play = ($: EngineInterface, asset: string) => {
  void $.audio.play({ asset }).catch(() => undefined)
}

// The time a message first showed up. Kept in memory, since drawing may not
// write state; a reload stamps older messages with the reload's time.
const seenAt = new Map<string, number>()

const stampFor = async ($: EngineInterface, id: string) => {
  let at = seenAt.get(id)

  if (at === undefined) {
    at = await $.clock.now()
    seenAt.set(id, at)

    if (seenAt.size > 500) {
      const oldest = seenAt.keys().next().value

      if (oldest !== undefined) {
        seenAt.delete(oldest)
      }
    }
  }

  return formatTime(at, await read($, tzOffset))
}

// --- the mod ---------------------------------------------------------------

export const register: Register = on => {
  let idleTimer: Timer | undefined

  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    const set = await $.theme.set(LOOK)

    if (!set.isDrawn) {
      $.ui.status(set.reason)
    }

    // The machine's time zone, so timestamps read as local time.
    try {
      const { stdout } = await $.process.run(['date', '+%z'], { timeoutMs: 3000 })
      const match = /([+-])(\d{2})(\d{2})/.exec(stdout.trim())

      if (match !== null) {
        const minutes = Number(match[2]) * 60 + Number(match[3])
        await update($, tzOffset, () => (match[1] === '-' ? -minutes : minutes))
      }
    } catch {
      // Timestamps fall back to UTC.
    }

    await $.command.register({ name: 'away', description: 'Set an away message (/away brb, pizza). No text: you are back.' })
    await $.command.register({ name: 'aim-speak', description: 'Toggle Claude writing like it is 1999 on AIM' })
    await $.command.register({ name: 'buddylist', description: 'Open the Buddy List pane (/buddylist clear signs idle agents off)' })
    await $.command.register({ name: 'warn', description: 'Reset the warning level to 0%' })

    // Idle time, counted once a minute while Claude is not typing.
    idleTimer?.cancel()
    idleTimer = $.clock.every(60_000, () => {
      void (async () => {
        const since = await read($, idleSince)

        if (since !== null) {
          const minutes = Math.floor(((await $.clock.now()) - since) / 60_000)
          await update($, idleMinutes, () => minutes)
        }
      })()
    })

    void $.ui.open({ id: PANE, title: 'Buddy List' })
    play($, 'sounds/signon.wav')

    return next(e)
  })

  on('session.end', ($, e, next) => {
    idleTimer?.cancel()

    return next(e)
  })

  // --- commands ---

  on('command.run', { command: 'away' }, async ($, e) => {
    const text = e.args.trim()

    if (text === '') {
      await update($, away, () => null)

      return { text: `${MY_NAME} has returned.`, isTextDisplayOnly: true, context: ['(The user cleared their away message.)'] }
    }
    await update($, away, () => text)

    return {
      text: `Away message set: "${text}"`,
      isTextDisplayOnly: true,
      context: [`(The user set an AIM-style away message: "${text}". No reply needed.)`],
    }
  })

  on('command.run', { command: 'aim-speak' }, async $ => {
    const isOn = !(await read($, isAimSpeak))
    await update($, isAimSpeak, () => isOn)

    return {
      text: isOn ? 'AIM speak is ON. omg ~*brb*~' : 'AIM speak is off.',
      isTextDisplayOnly: true,
      context: [isOn ? AIM_SPEAK_ON : AIM_SPEAK_OFF],
    }
  })

  on('command.run', { command: 'buddylist' }, async ($, e) => {
    if (e.args.trim() === 'clear') {
      await update($, buddies, list => list.map(b => (b.isOnline ? b : { ...b, isSignedOff: true })))

      return { text: 'Idle agents have signed off.', isTextDisplayOnly: true }
    }
    const opened = await $.ui.open({ id: PANE, title: 'Buddy List' })

    return { text: opened.isPlaced ? 'Buddy List opened.' : 'The Buddy List could not open here.', isTextDisplayOnly: true }
  })

  on('command.run', { command: 'warn' }, async $ => {
    await update($, warning, () => 0)

    return { text: `${BUDDY_NAME}'s warning level is back to 0%.`, isTextDisplayOnly: true }
  })

  // --- typing, idle, away ---

  on('prompt.submit', async ($, e, next) => {
    // Sending a message brings you back from away, like it did then.
    if ((await read($, away)) !== null) {
      await update($, away, () => null)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.start', async ($, e, next) => {
    if (e.agentId !== undefined) {
      const id = e.agentId
      await update($, buddies, list => list.map(b => (b.id === id ? { ...b, isOnline: true } : b)))

      return next(e)
    }
    await update($, isTyping, () => true)
    await update($, idleSince, () => null)
    await update($, idleMinutes, () => 0)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      const id = e.agentId
      await update($, buddies, list => list.map(b => (b.id === id ? { ...b, isOnline: false } : b)))

      return next(e)
    }
    await update($, isTyping, () => false)
    const now = await $.clock.now()
    await update($, idleSince, () => now)
    play($, 'sounds/ding.wav')

    return next(e)
  })

  on('turn.abort', async ($, e, next) => {
    await update($, isTyping, () => false)
    const now = await $.clock.now()
    await update($, idleSince, () => now)
    play($, 'sounds/signoff.wav')

    return next(e)
  }).catch(($, e, next) => next(e))

  // --- tool calls: warnings and buddies ---

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)

    // Bookkeeping never gets in the way of the tool itself.
    try {
      if (ran.deny !== undefined || ran.isError === true) {
        await update($, warning, level => Math.min(100, level + 10))
      }
    } catch {
      // Leave the counts as they were.
    }

    return ran
  })

  // Each agent Claude starts signs on as a buddy; its turn ending signs it off.
  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)

    if (spawned.agentId !== undefined) {
      const one: Buddy = { id: spawned.agentId, name: screenNameFor(e.description), isOnline: true }
      await update($, buddies, list => [...list.filter(b => b.id !== one.id), one].slice(-30)).catch(() => undefined)
    }

    return spawned
  })

  // --- drawing ---

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)
    const awayText = await read($, away)

    return <Svg source={sceneSvg(awayText)} alt="A retro buddy list window and an away message on a teal desktop" isInteractive />
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const isPlainPrompt = e.props.task === undefined && e.props.from === undefined

    if (!isGraphical(e.surface) || !isPlainPrompt) {
      return next(e)
    }
    const { Box, Text } = $.ui.resolve(e)
    const time = await stampFor($, e.requestId)

    return (
      <Box flexDirection="row" flexWrap="wrap" alignItems="flex-start" paddingX="sm" paddingY="xs" columnGap="xs">
        <Text color={RED} weight="bold">
          {MY_NAME}
          <Text color={RED} weight="regular" size="footnote">
            {` (${time})`}
          </Text>
          :
        </Text>
        <Box flexGrow={1} flexShrink={1}>
          <Text color="#000000">{e.props.text}</Text>
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (!isGraphical(e.surface)) {
      return next(e)
    }
    const { Box, Text, Markdown } = $.ui.resolve(e)
    const time = e.props.isFirstOfReply ? await stampFor($, e.requestId) : ''

    return (
      <Box flexDirection="row" alignItems="flex-start" paddingX="sm" paddingY="xs" columnGap="xs">
        {e.props.isFirstOfReply ? (
          <Text color={BLUE} weight="bold">
            {BUDDY_NAME}
            <Text color={BLUE} weight="regular" size="footnote">
              {` (${time})`}
            </Text>
            :
          </Text>
        ) : (
          <Text color={GRAY}>{'  '}</Text>
        )}
        <Box flexGrow={1} flexShrink={1}>
          <Markdown text={e.props.text} />
        </Box>
      </Box>
    )
  })

  // Each tool call gets a system line above its row, the way file transfers showed up.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (!isGraphical(e.surface)) {
      return next(e)
    }
    const { Box, Text } = $.ui.resolve(e)
    const row = await next(e)
    const input = (typeof e.props.input === 'object' && e.props.input !== null ? e.props.input : {}) as Record<string, unknown>
    let line = toolLine(e.props.tool, input, !e.props.isRunning)
    let color = GRAY

    if (e.props.isInterrupted) {
      line = `Connection to ${BUDDY_NAME} was interrupted.`
      color = RED
    } else if (e.props.isErrored) {
      line = `Error: ${BUDDY_NAME}'s request could not be completed (${e.props.tool}).`
      color = RED
    }

    return (
      <Box flexDirection="column">
        <Text color={color} italic size="footnote">
          {line}
        </Text>
        {row}
      </Box>
    )
  })

  // The IM window's chrome, above where you type: title bar, then the toolbar strip.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!isGraphical(e.surface) || e.props.hasSurvey) {
      return next(e)
    }
    const { Box, Text } = $.ui.resolve(e)
    const typing = await read($, isTyping)
    const level = await read($, warning)
    const awayText = await read($, away)
    const idle = await read($, idleMinutes)
    const speak = await read($, isAimSpeak)

    let status = `Instant Message with ${BUDDY_NAME}`
    let statusColor = GRAY

    if (typing) {
      status = `${BUDDY_NAME} is typing...`
      statusColor = BLUE
    } else if (awayText !== null) {
      status = `You are away: ${clip(awayText, 40)}`
      statusColor = RED
    } else if (idle >= 1) {
      status = `${BUDDY_NAME} is idle (${idle} min)`
    }

    return (
      <Box flexDirection="column" borderStyle="single" borderColor={GRAY}>
        <Box flexDirection="row" paddingX="sm" backgroundColor={NAVY} columnGap="sm">
          <Text color="#ffffff" weight="bold" size="footnote">
            {`${BUDDY_NAME} - Instant Message`}
          </Text>
          <Box flexGrow={1} />
          <Text color="#ffffff" size="footnote">
            {`Warning Level: ${level}%`}
          </Text>
          <Text color="#ffffff" size="footnote">
            _ □ ✕
          </Text>
        </Box>
        <Box flexDirection="row" columnGap="sm" paddingX="sm" backgroundColor={CHROME}>
          <Text color={NAVY} weight="bold" size="footnote">
            A
          </Text>
          <Text color={NAVY} size="footnote">
            A
          </Text>
          <Text weight="bold" size="footnote">
            B
          </Text>
          <Text italic size="footnote">
            I
          </Text>
          <Text underline size="footnote">
            U
          </Text>
          <Text size="footnote">☺</Text>
          {speak && (
            <Text color="#800080" weight="bold" size="footnote">
              ~*AIM speak*~
            </Text>
          )}
          <Box flexGrow={1} />
          <Text italic size="footnote" color={statusColor}>
            {status}
          </Text>
        </Box>
      </Box>
    )
  })

  // The Buddy List pane: Claude, you, and every agent Claude starts.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, buddies)
    const awayText = await read($, away)
    const typing = await read($, isTyping)
    const onList = list.filter(b => b.isSignedOff !== true)
    const working = onList.filter(b => b.isOnline)
    const offline = list.filter(b => b.isSignedOff === true).slice(-12)

    return (
      <Box flexDirection="column" rowGap="xs" padding="xs">
        <Box backgroundColor="#ffcc00" paddingX="sm" paddingY="xs" borderStyle="single" borderColor={GRAY}>
          <Text weight="bold" color="#000000">
            {`${MY_NAME}'s Buddy List`}
          </Text>
        </Box>
        <Text weight="bold">▾ Buddies (1/1)</Text>
        <Text color={BLUE} weight={typing ? 'bold' : 'regular'}>
          {`   ${BUDDY_NAME}${typing ? '  ✎' : ''}`}
        </Text>
        <Text weight="bold">{`▾ Agents (${working.length}/${onList.length})`}</Text>
        {onList.length === 0 && (
          <Text color={GRAY} italic>
            {'   nobody online'}
          </Text>
        )}
        {onList.map(b =>
          b.isOnline ? (
            <Text color="#000000" weight="bold">{`   ${b.name}  ✎`}</Text>
          ) : (
            <Text color={GRAY} italic>{`   ${b.name} (idle)`}</Text>
          ),
        )}
        <Text weight="bold">▾ Me</Text>
        <Text color={awayText === null ? RED : GRAY} italic={awayText !== null}>
          {`   ${MY_NAME}${awayText === null ? '' : ' (away)'}`}
        </Text>
        <Text weight="bold" color={GRAY}>{`▸ Offline (${offline.length})`}</Text>
        {offline.map(b => (
          <Text color={GRAY}>{`   ${b.name}`}</Text>
        ))}
      </Box>
    )
  })
}
