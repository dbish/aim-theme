# aim-theme

A Claude Code mod that turns the conversation into a late-90s instant-message window: screen names and timestamps on every message, a teal desktop with a buddy list, a typing indicator, sign-on and message sounds, and a Buddy List pane where every agent Claude starts signs on as a buddy.

Best in the Claude desktop app (the look is light mode only).

![The AIM theme in the Claude desktop app: claudeBot98's timestamped reply with an ASCII "You've Got Mail!" banner, the Buddy List pane, and the IM title bar above the prompt](docs/screenshot.png)

![Demo: claudeBot98 typing, a helper agent signing on in the Buddy List, and the reply arriving](docs/demo.gif)

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install aim-theme --marketplace dbish/aim-theme
```

Answer `y` to add the marketplace, then press Enter to install it for your user (every session).

From a shell:

```bash
claude plugin install aim-theme --marketplace dbish/aim-theme
```

In the desktop app: click **+** next to the prompt box, then **Plugins** → **Add marketplace** with `dbish/aim-theme`, then **Add plugin**.

## Commands

- `/away <message>`: set an away message (`/away` with no text: you're back)
- `/aim-speak`: toggle Claude writing like it's 1999 on AIM
- `/buddylist`: open the Buddy List pane (`/buddylist clear` signs idle agents off)
- `/warn`: reset the warning level to 0%

## Make it yours

Change `MY_NAME` and `BUDDY_NAME` at the top of `hooks/register.tsx` for your own screen names.
