/**
 * Shared Anthropic API constants.
 *
 * WHY THIS FILE EXISTS:
 * The Claude model ID used to be hardcoded in four separate files (two
 * frontend services and two Netlify functions). When `claude-sonnet-4-20250514`
 * was retired, we fixed two of them and missed the other two — the plant
 * identification feature stayed broken for weeks because the duplicate was
 * invisible. Defining these here means a model change is a one-line edit.
 *
 * WHY IT LIVES IN /shared AND NOT /src:
 * The Netlify functions in /netlify/functions are bundled separately from the
 * Vite frontend and cannot use the '@/' alias (that alias only exists in
 * vite.config.ts and tsconfig.app.json). A plain relative import from a
 * top-level folder is the one path both build systems understand.
 *
 * WHAT DOESN'T BELONG HERE:
 * MAX_TOKENS stays local to each caller — the advice endpoint genuinely needs
 * more room (500) than the identification endpoint (200). That's intentional
 * variation, not duplication.
 */

/**
 * The Claude model used for every AI call in the app.
 *
 * Anthropic retires older models on a published schedule, and a retired model
 * makes every request fail. If AI features suddenly stop working across the
 * board, check whether this model is still current before debugging anything
 * else — that has been the cause twice now.
 */
export const CLAUDE_MODEL: string = 'claude-sonnet-4-6';

/** Anthropic API version header. Rarely changes, but must match everywhere. */
export const ANTHROPIC_VERSION: string = '2023-06-01';

/** Anthropic Messages API endpoint (used server-side by the Netlify functions). */
export const ANTHROPIC_API_URL: string = 'https://api.anthropic.com/v1/messages';
