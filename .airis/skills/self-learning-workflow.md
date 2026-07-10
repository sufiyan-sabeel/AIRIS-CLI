---
name: self-learning-workflow
description: Evidence-based development workflow for AIRIS coding tasks. Implements a 5-phase pipeline with self-learning and verification loops.
---

# Self-Learning Workflow

This workflow guides AIRIS during development tasks using an evidence-based improvement loop. Follow it automatically for every coding task.

## Core Principles

- **Think before coding** — analyze the problem and design the solution before writing code.
- **Verify before completing** — run checks, re-read changed files, and confirm no regressions.
- **Never invent features or results** — only work with verified repository content.
- **Preserve existing architecture** — reuse components, patterns, and dependencies.
- **Make minimal, professional, reviewable changes** — small focused edits over large rewrites.

## Evidence-Based Improvement Loop

This loop runs throughout the entire workflow. Each phase feeds into the next iteration:

```
┌─────────────┐
│   Observe   │── Read, inspect, diagnose
└──────┬──────┘
       ↓
┌─────────────┐
│   Learn     │── Identify patterns, root causes, reusable solutions
└──────┬──────┘
       ↓
┌─────────────┐
│   Adapt     │── Apply the smallest verified improvement
└──────┬──────┘
       ↓
┌─────────────┐
│   Record    │── Log problem, fix, result, remaining risk
└──────┬──────┘
       │ (loop back to Observe if issues remain)
       ↓
    Complete
```

---

## Phase 1: Analysis and Planning

Before editing any file, establish a complete understanding of the task.

### Steps

1. **Read all relevant files in full.** Do not rely on search snippets or partial reads for wide-ranging changes.
2. **Understand the project structure:**
   - Root `package.json` workspace layout
   - Monorepo dependencies (`packages/*/package.json`)
   - Build and test scripts
   - TypeScript configuration
   - Existing routes, components, and data flow
3. **Understand the specific area:**
   - Component dependencies and props
   - API contracts and data types
   - Styling approach (CSS, Tailwind, CSS-in-JS)
   - Animation and interaction patterns
4. **Create a concise implementation plan:**
   - List files likely to change
   - Identify components to reuse
   - Identify components to improve or add
   - Identify dependencies required or not required
   - Note deployment, accessibility, and performance risks

### Output

A written plan containing:
- Current architecture summary
- Verified problems
- Files to change
- Components to use, improve, or add
- Dependencies needed (or none needed)
- Risks and mitigations

Do not skip to implementation until the plan is clear.

---

## Phase 2: Reading, Analysis, and Algorithm Design

Before coding each major feature or fix, trace the complete code path.

### Steps

1. **Read the affected code completely.** Read the entire file — not just the region you plan to change.
2. **Trace dependencies and data flow:**
   - Which components import this file?
   - What props/types flow through it?
   - What external APIs or services does it touch?
   - What build-time constraints exist (static export, server/client boundaries)?
3. **Understand layout and rendering behavior:**
   - Server vs client component boundaries
   - Hydration requirements
   - Responsive breakpoints
   - Reduced-motion behavior
4. **Design the safest algorithm before coding.**
   - Write the algorithm in plain language or pseudocode
   - Consider error states, edge cases, and fallbacks
   - Verify the algorithm matches the existing architecture
5. **Summarize the planned changes.**

### Algorithm Documentation Pattern

For complex features, document the algorithm explicitly:

```
## Algorithm: <Feature Name>

1. Load/read verified data
2. Transform/process data
3. Handle loading, empty, error states
4. Render with animation (respecting reduced motion)
5. Clean up listeners and timers on unmount
6. Provide fallback for unsupported environments
```

### Examples

**Terminal animation algorithm:**
1. Load verified command steps
2. Animate input text character by character
3. Pause briefly between input and output
4. Show execution state indicator
5. Reveal output with typewriter or instant display
6. Transition to next command step
7. Stop or loop only when appropriate
8. Disable or simplify under reduced motion

**Scroll reveal algorithm:**
1. Detect section visibility via IntersectionObserver
2. Trigger animation once per element
3. Use transform and opacity only (no layout shift)
4. Disable movement for reduced-motion users

---

## Phase 3: Coding and Building

Make the smallest safe changes that achieve the goal.

### Steps

1. **Make targeted edits.** Prefer precise replacements over rewrites.
2. **Reuse existing architecture:**
   - Use existing component patterns and conventions
   - Follow the project's coding standards (TypeScript, lint rules, imports)
   - Use the same styling approach (Tailwind classes, CSS variables)
   - Use existing animation primitives (Framer Motion variants, CSS animations)
3. **Follow project-specific rules:**
   - No `any` unless absolutely necessary
   - Use only erasable TypeScript syntax
   - Inline single-use helpers
   - No inline imports (`await import()`, dynamic type imports)
   - Keep changes modular and reviewable
4. **Build only the affected package or workspace.**
   - Verify the build for the specific package: `npm run build` from its directory
   - Or use the root build: `npm run build` (sequential build)
5. **If errors occur during build:**
   - Re-read the error carefully
   - Identify the root cause
   - Fix the smallest relevant area
   - Rebuild and retry

### Safety Rules

- Do not overwrite generated, lockfile, binary, or large files unless the user asks.
- Do not remove working features.
- Do not add placeholder components without purpose.
- Keep edits small, reviewable, and reversible.
- Ask before destructive operations.

---

## Phase 4: Testing and Debugging

Run available checks and fix every verified failure.

### Steps

1. **Run available commands in order:**
   ```bash
   # Lint
   npm run lint           # or: cd <package> && npm run lint
   
   # Type check
   npm run typecheck       # or: npx tsc --noEmit
   
   # Tests
   npm test                # or: node --test test/*.test.ts
   
   # Build
   npm run build           # or: cd <package> && npm run build
   ```

2. **For website packages, also verify:**
   ```bash
   cd website
   npm run lint
   npm run build
   ```

3. **Test the specific area:**
   - Main page rendering
   - Navigation and routing
   - Interactive components (copy buttons, tabs, dialogs)
   - Animation behavior
   - Reduced-motion mode
   - Keyboard navigation
   - Small screen layout
   - Responsive behavior
   - Static export paths
   - Breakage of existing functionality

4. **Debug every verified failure:**
   - Identify the exact failure
   - Trace the root cause
   - Fix the smallest relevant area
   - Re-run the failing check
   - Re-read the changed file
   - Verify no regression was introduced

5. **Repeat until checks pass** or a documented external blocker remains.

### Debugging Rules

- Do not suppress errors with `continue-on-error`, disabled tests, or ignored TypeScript errors.
- Do not hide failures with empty catch blocks or hardcoded fake data.
- Do not disable ESLint rules to make lint pass.
- If a fix introduces a new failure, roll back and try a different approach.

---

## Phase 5: Verification

Confirm all changes are correct and complete before finishing.

### Steps

1. **Re-read every modified file** — verify imports, exports, types, and formatting.
2. **Verify component props** — no missing required props, no type mismatches.
3. **Verify CSS classes** — no typos, no unused classes, no broken responsive behavior.
4. **Verify animation cleanup:**
   - Event listeners are removed on unmount
   - Timers and intervals are cleared
   - Animation subscriptions are cleaned up
5. **Verify accessibility:**
   - Semantic landmarks and heading structure
   - Visible focus states
   - Keyboard navigation
   - Screen-reader labels
   - Reduced-motion support
   - Sufficient color contrast
6. **Verify responsive behavior:**
   - Test at 320px, 480px, 768px, 1024px, 1440px
   - No horizontal overflow
   - No clipped content
   - No unreadable text
   - No hover-only functionality
7. **Verify static export / GitHub Pages compatibility:**
   - Correct `basePath` and `assetPrefix`
   - No unsupported server-only routes or API routes
   - Correct output directory
   - Correct asset paths
8. **Run final checks:**
   - `npm run check` (full output, no tail)
   - Fix all errors, warnings, and infos

### Verification Checklist

```
- [ ] All modified files re-read and verified
- [ ] Imports and exports correct
- [ ] TypeScript types correct
- [ ] CSS classes valid
- [ ] Animation cleanup confirmed
- [ ] Accessibility attributes present
- [ ] Keyboard navigation works
- [ ] Reduced motion respected
- [ ] Responsive at all breakpoints
- [ ] No horizontal overflow
- [ ] Static export builds
- [ ] GitHub Pages paths correct
- [ ] Lint passes
- [ ] Type check passes
- [ ] Tests pass
- [ ] Build passes
- [ ] No unrelated files changed
- [ ] No secrets added
```

If any check fails, return to Phase 1 (Analysis) or Phase 3 (Coding) depending on the severity of the issue. Do not mark complete until all checks pass or a documented blocker prevents further progress.

---

## Workflow Application

### When to Use This Workflow

This workflow applies automatically to every coding task, including:
- Bug fixes
- Feature additions
- Refactoring and optimization
- Accessibility improvements
- Performance improvements
- Documentation updates
- Configuration changes

### When to Skip or Simplify

- **Trivial changes** (typo fix, single-line CSS change, simple text update): Phases 1-2 can be brief, but Phases 3-5 still apply.
- **Exploratory or diagnostic tasks** (read-only investigation, debugging without changes): Apply Phases 1-2 only, then report findings.
- **Emergency fixes** (production outage, broken build): Apply Phases 3-5 with urgency, document skipped analysis afterward.

### Integration with Other Skills

Load this skill alongside other skills for complex tasks:

```bash
airis --skill ./.airis/skills/self-learning-workflow.md --skill ./.airis/skills/add-llm-provider.md
```

The self-learning workflow governs *how* you work. Domain-specific skills govern *what* you build.

---

## Final Deliverables

After completing all phases, produce a summary containing:

1. **Analysis** — problems found, architecture understood
2. **Plan** — what was planned vs what was done
3. **Changes** — files changed, dependencies added/removed
4. **Tests** — commands run, tests passed/failed
5. **Verification** — checklist results, build status
6. **Remaining Issues** — any unresolved problems
7. **Next Steps** — recommended follow-up work

This summary serves as documentation for the current session and context for the next one.
