# Research: accessible combobox to replace CitySelect (#172)

Date: 2026-08-17. Feeds issue #189 (do the replacement).

Location note: the repo had no folder for research notes (`docs/adr/` holds ADRs, `docs/superpowers/` holds skill-produced specs and plans), so this file starts a `docs/research/` convention.

## What we have today

`apps/motori/src/components/listings/city-select.tsx` is a hand-rolled input + dropdown over the static municipality list (`apps/motori/src/lib/municipalities.ts`, 310 entries with `name`, `region`, `lat`, `lng`). It is used in five places: `mobile-search-overlay.tsx`, `listing-form.tsx`, `tori-item-form.tsx`, `routes/taydenna-profiili.tsx`, `routes/profiili/asetukset.tsx`.

What it lacks, measured against the [WAI-ARIA APG combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/):

- The input has no `role="combobox"`, no `aria-expanded`, `aria-controls`, `aria-autocomplete`, or `aria-activedescendant`. The listbox `div` has `role="listbox"` but nothing ties it to the input.
- No arrow-key navigation at all. Enter commits only when the filter leaves exactly one match. Home/End, Alt+Down and friends do nothing.
- Options are `div`s that respond only to `onMouseDown`. A keyboard or screen-reader user cannot pick one.
- No announcements: a screen reader hears nothing when the list opens, filters, or changes highlight.

## What the APG pattern requires

From the [APG combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) (editable combobox with list autocomplete; worked example: [Editable Combobox With List Autocomplete](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-autocomplete-list/)):

- Keyboard: Down/Up arrows move through options, Enter accepts the focused option and closes the popup, Escape dismisses the popup, printable characters keep filtering, optional Alt+Down/Alt+Up and Home/End behaviour.
- ARIA: `role="combobox"` on the input with `aria-expanded`, `aria-controls` pointing at the popup, `aria-autocomplete="list"`, `aria-selected` on the chosen option.
- Focus: "DOM Focus is maintained on the combobox and the assistive technology focus is moved within the listbox using `aria-activedescendant`". DOM focus never leaves the input.

## Candidates

Bundle sizes below are my own measurement: each candidate's combobox imports bundled with esbuild (`--bundle --minify --format=esm`, `react`/`react-dom` external), then gzipped. Exact versions: downshift 9.4.0, react-aria-components 1.20.0, @base-ui/react 1.7.0, @ariakit/react 0.4.37, cmdk 1.1.1, on React 19. A [bundlejs](https://bundlejs.com) cross-check of `downshift` tree-shaken to `useCombobox` gave 16.1 kB gzip, close to my 13.5 kB, so the method looks sane. Download counts are the npm downloads API for the week 2026-08-09 to 2026-08-15 (`api.npmjs.org/downloads/point/last-week/<pkg>`).

### 1. Hand-rolled, following the APG pattern

Doing it properly means implementing everything in the section above ourselves, plus a live region for result counts, plus outside-click and blur commit rules. The APG describes the contract but not the screen-reader reality. Adobe's engineers documented that reality in [their ComboBox write-up](https://react-aria.adobe.com/blog/building-a-combobox): "VoiceOver has limited support for `aria-activedescendant`, failing to announce when the focused ComboBox item changed in a variety of situations", NVDA needed option focus cleared while typing, and mobile screen readers needed a different structure entirely. Their conclusion: "manual testing is irreplaceable for surfacing these behavioral differences." We have no screen-reader test matrix and no budget to build one. Bundle cost ~0 kB; everything else is on us, forever.

### 2. downshift (`useCombobox`)

- Pattern coverage: the [README](https://github.com/downshift-js/downshift) claims "WAI-ARIA compliant" primitives, and the [useCombobox docs](https://www.downshift-js.com/use-combobox) state it follows the ARIA 1.2 combobox pattern since v7. The published code handles ArrowUp/ArrowDown, Home, End, PageUp/PageDown, Enter, Escape and sets `aria-activedescendant` (verified by grepping `downshift@9.4.0/dist/downshift.esm.mjs`).
- Screen readers: announcements are opt-in via a `getA11yStatusMessage` prop; there is no rendered popup or live region because downshift renders no DOM at all. Open tracker items include VoiceOver bugs around its select/multi-select hooks ([#1664](https://github.com/downshift-js/downshift/issues/1664), [#1643](https://github.com/downshift-js/downshift/issues/1643), [#1555](https://github.com/downshift-js/downshift/issues/1555)).
- SSR / React 19: peer range `react >=16.12.0`; the hooks call React's `useId` (in the published bundle), so server and client ids match. A React 19 + Next 15 report ([#1605](https://github.com/downshift-js/downshift/issues/1605)) is closed.
- Bundle: 13.5 kB min+gzip for `useCombobox`. Smallest by far.
- Styling: pure hooks, our DOM, our Tailwind classes. But also our positioning, our empty state, our live region.
- Health: v9.4.0 released 2026-06-30 ([npm](https://www.npmjs.com/package/downshift)), 3.70M weekly downloads, 12.3k stars. Community project, effectively one active maintainer; an open request to drop `prop-types` ([#1606](https://github.com/downshift-js/downshift/issues/1606)) has sat since early 2026.
- 300 items: filtering is entirely ours (fine, we already have a `startsWith` filter).

### 3. Base UI (`@base-ui/react/combobox`)

- Note the package renamed at 1.0: "The package name has changed from `@base-ui-components/react` to `@base-ui/react`" ([v1.0.0 release notes](https://github.com/mui/base-ui/releases/tag/v1.0.0)). Weekly-download comparisons against the old name undercount it badly.
- Pattern coverage: a complete part set (`Root`, `Input`, `Trigger`, `Portal`, `Positioner`, `Popup`, `List`, `Item`, `Empty`, `Status`, ...) per the [Combobox docs](https://base-ui.com/react/components/combobox), which state the focus behaviour follows "ARIA Authoring Practices". The published code confirms ArrowUp/ArrowDown, Home, End, Enter, Escape handling and `aria-activedescendant` (grep of `@base-ui/react@1.7.0/combobox/input/ComboboxInput.mjs` and the bundled floating-ui `useListNavigation`).
- Screen readers: `Combobox.Status` renders an `aria-live` region for result counts (verified in `ComboboxStatus.mjs`), and `Combobox.Empty` covers the no-results case. The [About page](https://base-ui.com/react/overview/about) says "Accessibility is our primary focus" with testing across screen readers, though unlike Adobe they publish no test matrix. Open combobox issues are small: an exit-animation state nit ([#5519](https://github.com/mui/base-ui/issues/5519)) and a hardcoded English "Dismiss" `aria-label` on the internal dismiss button ([#5263](https://github.com/mui/base-ui/issues/5263)) — that button only appears in the input-inside-popup layout, which we would not use, but it is worth remembering for a Finnish UI.
- SSR / React 19: peers `react ^17 || ^18 || ^19` (`date-fns` peers are marked optional). No combobox SSR issues in the tracker; open hydration issues exist for other components (avatar [#4468](https://github.com/mui/base-ui/issues/4468), progress [#4616](https://github.com/mui/base-ui/issues/4616)), so the usual `pnpm build` + prod smoke test from CLAUDE.md still applies.
- Bundle: 49.9 kB min+gzip for the combobox subpath. That includes popup positioning (bundled Floating UI), portal, list, filtering.
- Styling: unstyled; `className` accepts a function of state and items expose data attributes like `data-highlighted` ([docs](https://base-ui.com/react/components/combobox)). Maps directly onto our Tailwind v4 utility classes and `packages/ui` tokens.
- Health: built by "developers from leading UI projects: Radix, Material UI, and Floating UI" under the MUI org ([About](https://base-ui.com/react/overview/about)); stable 1.x with monthly minors, 1.7.0 on 2026-08-04 ([releases](https://github.com/mui/base-ui/releases)); 8.58M weekly downloads ([npm](https://www.npmjs.com/package/@base-ui/react)); 10.7k stars.
- 300 items: client-side filtering is built in via the `filter` prop and a `Combobox.useFilter` hook with a `locale` option ("The locale to use for string comparison. Defaults to the user's runtime locale") — locale-aware matching is a real win for Finnish names with ä/ö/å. The docs bring in virtualization only for a 10,000-item example and say "Memoizing each item is a simpler alternative to virtualization for datasets up to roughly 1,000 items", so 310 items need nothing special.

### 4. React Aria (`react-aria-components` ComboBox)

- Pattern coverage: full APG behaviour with `aria-activedescendant` virtual focus (the attribute is present three times in my bundled output; the [ComboBox blog post](https://react-aria.adobe.com/blog/building-a-combobox) explains the design). Anatomy: `ComboBox` + `Input` + `Button` + `Popover` + `ListBox` + `ListBoxItem` ([docs](https://react-aria.adobe.com/ComboBox)).
- Screen readers: the best-documented of all candidates. The [Quality page](https://react-aria.adobe.com/quality) lists testing on VoiceOver (macOS Safari/Chrome, iOS), JAWS, NVDA, and TalkBack, and the blog post covers the mobile tray, `role="searchbox"` on mobile, and hiding outside content from screen readers. Still not bug-free: open issues include "Combobox only announces item name with VoiceOver" ([#10220](https://github.com/adobe/react-spectrum/issues/10220)) and a VoiceOver announcement gap in Autocomplete ([#10326](https://github.com/adobe/react-spectrum/issues/10326)).
- SSR / React 19: peers include `^19.0.0-rc.1`; SSR is supported and [SSRProvider is unnecessary on React 18+](https://react-aria.adobe.com/SSRProvider) since ids come from React's `useId`.
- Bundle: 61.1 kB min+gzip for the ComboBox part set. Largest candidate.
- Styling: unstyled, `className` can be a function of render state, elements get default `.react-aria-*` classes and data attributes; the docs show a Tailwind helper (`composeTailwindRenderProps`).
- Health: Adobe-backed, 1.20.0 released 2026-07-31 ([npm](https://www.npmjs.com/package/react-aria-components)), roughly monthly releases, 2.58M weekly downloads, 15.8k stars.
- 300 items: built-in "language-sensitive 'contains' filter from `useFilter`" as the default `defaultFilter` ([docs](https://react-aria.adobe.com/ComboBox)); no virtualization needed at this size.

### 5. Radix-adjacent: cmdk and Ariakit

Radix itself ships no combobox primitive; its ecosystem (shadcn/ui) builds comboboxes from **cmdk** inside a Radix Popover.

**cmdk** ([repo](https://github.com/pacocoursey/cmdk), now redirecting to dip/cmdk): a command menu "that can also be used as an accessible combobox". It sets `role="combobox"` and `aria-activedescendant` (present in the published bundle), but the code handles ArrowUp/ArrowDown, Home, End, Enter and leaves Escape and popup behaviour to whatever wraps it; the README recommends adding Radix Popover for the dropdown, a dependency we do not have. Its default filtering is fuzzy scoring that reorders results, which suits command palettes more than a city field. Tracker has long-open aria bugs: "The aria-activedescendant attribute is sometimes missing" ([#373](https://github.com/pacocoursey/cmdk/issues/373)) and "Role 'listbox' causes some aria issues" ([#179](https://github.com/pacocoursey/cmdk/issues/179)). Last release 1.1.1 on 2025-03-14 ([npm](https://www.npmjs.com/package/cmdk)), last commit 2025-10-29. The 38.5M weekly downloads come from shadcn templates, not from active maintenance. 17.4 kB min+gzip plus the popover you still need.

**Ariakit** ([Combobox docs](https://ariakit.com/components/combobox)): "based on the WAI-ARIA Combobox Pattern", unstyled, `data-active-item` styling hook, `aria-activedescendant` in its core. Solid and actively maintained (0.4.37 on 2026-08-09, [npm](https://www.npmjs.com/package/@ariakit/react); 1.16M weekly downloads; 8.6k stars), but still 0.4.x after years, effectively one core maintainer, filtering left to userland (the docs demo `startTransition`/`useDeferredValue`, no built-in filter helper), and 43.0 kB min+gzip — most of Base UI's cost without the stable-1.x backing.

## Comparison

| | APG keys + activedescendant | Announcements | SSR/React 19 | min+gzip | Filtering built in | Health |
|---|---|---|---|---|---|---|
| Hand-rolled | ours to build | ours to build | fine | ~0 | ours | ours to maintain |
| downshift | yes (verified in code) | opt-in prop | useId, peers `>=16.12` | 13.5 kB | no | 1 maintainer, Jun 2026 release |
| Base UI | yes (verified in code) | `Status` live region | peers 17-19, no combobox issues found | 49.9 kB | yes, locale-aware | MUI org, monthly, stable 1.x |
| React Aria | yes, best documented | published test matrix; 2 open VoiceOver issues | supported, no SSRProvider needed | 61.1 kB | yes, locale-aware | Adobe, monthly |
| Ariakit | yes | not documented per part | peers 17-19 | 43.0 kB | no | 0.4.x, ~1 maintainer |
| cmdk | partial (no Escape/popup) | open aria bugs | peers 18-19 | 17.4 kB + popover | fuzzy (reorders) | dormant since Mar 2025 |

## Recommendation: Base UI Combobox (`@base-ui/react/combobox`)

It is the only candidate that covers the whole gap in one dependency: verified APG keyboard handling with `aria-activedescendant`, a live region for result announcements, popup positioning and portal included, and built-in locale-aware filtering that handles Finnish characters correctly. It is unstyled with state exposed as data attributes, so our existing Tailwind v4 classes from `packages/ui` transfer directly. The team (ex-Radix, Floating UI, Material UI, under the MUI org) ships monthly stable releases and React 19 is in the peer range.

The honest trade-offs: 49.9 kB min+gzip against downshift's 13.5 kB, and Base UI's screen-reader testing is asserted rather than published the way Adobe's is. I still would not pick downshift here, because everything it omits (positioning, live region, empty state, screen-reader quirk handling) is exactly the code we got wrong the first time. React Aria's extra 11 kB and much larger API buy us a published test matrix but also its own open VoiceOver announcement bugs, so it is not strictly safer, just bigger. A hand-rolled APG widget fails on the same evidence: Adobe needed a device lab to make the pattern actually work in screen readers, and we do not have one.

## Sketch for #189

Keep `CitySelect`'s public props exactly as they are (`value`, `onChange(city, region)`, `onBlur`, `id`, `placeholder`) so none of the five call sites change. Rebuild its internals as `Combobox.Root` with `items={MUNICIPALITIES}`, `itemToStringLabel` returning the name, and `onValueChange` calling `onChange(m.name, m.region)`; render `Input`, `Portal > Positioner > Popup > List > Item`, plus `Combobox.Empty` with "Ei tuloksia" and `Combobox.Status` for count announcements. Style the input with the same classes as `packages/ui/src/input.tsx` and the popup with the existing popover classes, using `data-highlighted` for the active row. Use `Combobox.useFilter` (contains, Finnish locale) instead of the current `startsWith`. Verify with the standard prod-build smoke test from CLAUDE.md (`pnpm build`, run the server output, check for hydration/CSP breakage) and an e2e pass over one form that uses it.
