# THE WAY management suite

Next.js frontend for owners and admins. Copy `.env.example` to `.env` and configure the backend URL and matching request-signing secret, then run `npm ci` and `npm run dev`.

## Verification

- `npm test`: run the Vitest + React Testing Library suite.
- `npm run test:watch`: rerun tests during development.
- `npm run typecheck`: generate Next route types and check TypeScript.
- `npm run build`: build the production application.

The tests use simulated HTTP responses and exercise credential assignment/replacement, provider-specific validation, revocation confirmation, failure recovery, role restrictions, and operator readiness. They do not validate live provider credentials or replace backend authorization tests.

If old generated route files cause TypeScript errors after moving pages, clear the `.next` build cache and regenerate it.

## Operator provisioning

Invite the operator from **operadores**. Once the invitation is accepted, use **Gestionar llaves** in the directory or open **llaves api**. Assign Anthropic or OpenAI credentials to enable AI; CX requires a location ID and does not by itself enable AI. Saving the same provider for the same person replaces their existing credential. Revocation requires confirmation.

The UI shows only the masked key returned by the backend and clears secret inputs after a successful save. Setup status reflects credential presence, not whether the provider has validated the credential. Model choices mirror the backend catalog in `src/core/llm/langchain/providers`; update both when changing supported models. Leaving the model blank uses the backend default.

## Skills

Owners and admins manage skills in **skills**. The coworking chat uses the regular conversations API: the first message carries a hidden brief (`src/features/skills/draft.ts`) asking the agent to write the whole skill file inside a four-backtick `skill` fence, and any hand edits in the editor are sent along with the next message. Drafts load into the editor automatically unless it has unsaved edits. The agent never saves anything; the user saves from the editor. `.md` uploads are saved directly (name and description come from the frontmatter, or the name from the filename) and replace a skill with the same name. The client-side validation mirrors `src/skills/config.py` in the backend.

## Design system

`src/app/theme.css` holds the tokens shared with THE WAY Desktop: brand colours, surfaces, text colours, font stacks, and effect levels. It is the canonical copy; the desktop app syncs it with `npm run theme:sync` and fails `npm run theme:check` if it drifts.

The effect level is set with `data-effects` on `<html>`. The desktop app uses the default **full** level (strong scanlines, neon glow). This panel sets **calm** in `src/app/layout.tsx`: faint scanlines, no ambient glow, and `--glow-accent` kept only on primary buttons and active states.

Type roles in the panel: IBM Plex Sans (`--font-sans`) for body text, tables and inputs; JetBrains Mono (`--font-mono`) for headings, labels, numbers and actions. The list of mono elements lives in `src/app/console.css`. The operators page (`/members`) is the reference for the calm style.
