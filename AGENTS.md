# Hardy Hub: rules for AI coding tools

Read this before changing any screen. Hardy Hub is a private family app that is used mostly on phones and is being packaged for the App Store. It must look like a designed native app with its own identity. It must not look like a website that an AI generated.

If a rule here conflicts with a habit you have from other projects, this file wins.

## The one test

Before you finish any UI work, look at the screen and ask: "Could this be any AI built SaaS dashboard?" If yes, it is not done. The usual causes are listed under "Never do this". Fix those first.

## Never do this

These are the patterns that make the app look generic. Each one has been called out by the owner.

- **No pill shapes.** Do not use `rounded-full` on buttons, chips, tabs, filters, badges or toggles. `rounded-full` is only for things that are truly round: avatars, status dots, switch thumbs, progress bars, spinners.
- **No pale on pale.** Do not build a screen out of white cards with 5 to 20 percent colour tints, `bg-muted/40` wells, `border-border/40` hairlines and `text-muted-foreground` everywhere. If a box, chip or selected state is only a faint tint of its background, it is wrong.
- **No floating hover lift as the main interaction.** Do not add `hover:-translate-y` to make things "float". Phones have no hover. Controls respond to being pressed.
- **No soft glow.** Do not use `shadow-glow`, wide blurred shadows or gradient icon tiles with a glow behind them.
- **No dashed placeholder boxes** for empty states, and no "coming soon" shells.
- **No text links pretending to be buttons.** A plus icon with coloured text and no box is not a button.
- **No raw icon plus label** as the only styling of an action. Use the `Button` component, which puts the icon in its own chip.
- **No horizontal page scroll** and no rows of controls that scroll sideways. Wrap or stack instead.
- **No scrolling inside a small widget** to reach more buttons. Fit them in (see "Fit, do not scroll").
- **No hyphens or dashes joining sentences** in any text a person reads (screen copy, emails, docs). Write two sentences or use "and" or "but".

## Shape

The corner scale is set once in `tailwind.config.ts` and is deliberately tight. Use the class names and do not invent your own radii with `rounded-[...]`.

| Class | Size | Use for |
| --- | --- | --- |
| `rounded-md` | 4px | chips, tags, option blocks, icon chips |
| `rounded-lg` | 6px | buttons, inputs, small tiles |
| `rounded-xl` | 8px | cards, panels |
| `rounded-2xl` | 10px | large cards, dialogs |
| `rounded-3xl` | 14px | hero blocks only |

## The register: premium, not loud

The app should feel upmarket: closer to a private bank, Wimbledon or British Airways than to a toy or a startup dashboard. Strong does not mean bright. If a screen looks like a set of primary coloured building blocks, it is wrong in the other direction.

- **Type.** Titles and key figures use the serif display face (`font-display`, Fraunces). Everything else uses the body sans (DM Sans). Small labels are uppercase with wide tracking (`tracking-[0.12em]`). Do not introduce other fonts.
- **Finish.** Solid blocks and buttons take the `btn-edge` class (a soft light from above and a fine base line). Header bands take the `band` class, which adds a faint sheen and a brass hairline along the bottom.
- **Edges.** Cards and rows use a fine 1px border (`border border-foreground/20`) with `shadow-card`. Do not use thick 2px borders on cards.
- **Space.** Give content room. Do not pack controls edge to edge.

## Colour

- **Use the jewel palette** in `src/lib/brandPalette.ts` (`JEWEL`, `JEWEL_CYCLE`): ink, petrol, forest, burgundy, cobalt, aubergine, bronze, slate, oxblood, teal, indigo, moss, plum, marine. These are deep, rich tones that take white text. Do not use bright Tailwind 500 and 600 shades (orange, fuchsia, sky, lime) for blocks or bands.
- **Solid colour blocks carry meaning.** A section header, a selected option, a key number or a status is a solid deep fill with white text. It is not a faint tint and not a bright primary.
- **Give sections their own colour.** When a page has several sections or steps, give each one a jewel tone and reuse it for that section's header band, selected controls and accents. Set it once as a CSS variable on the section container (see `--sec` in `src/pages/BusinessModellerDetail.tsx`, which is the reference page).
- **Status colours are fixed** (`STATUS_COLOR`). Good is deep green `#1F6B4F`. Warning is brass `#C9A24A` with dark text `#2A2110`. Bad is deep red `#9B2C2C`.
- **Brass is the accent.** Use the `gold` token or `BRASS` for hairlines and small marks only, never for large fills.
- **Brand colours** are the `primary` and `gold` tokens. Use them through the theme tokens so the user's chosen theme still works. Do not hard code the brand teal.
- **The canvas is warm stone and cards are ivory**, about 12 points of lightness apart. Keep that gap. A few percent is not enough.
- **Contrast is measured, not hoped for.** A surface must differ from the one behind it by a gap you can see at a glance on a poor screen.

## Buttons and controls

- **Always use `Button` from `src/components/ui/button.tsx`.** It is a squared block with a refined finish that presses in when tapped. Put the icon first and the label second and the icon chip is added for you: `<Button><Plus /> New scenario</Button>`. Do not add `mr-1`, sizes or gradients to the icon.
- **Do not restyle buttons per page** with `rounded-xl bg-gradient-primary shadow-glow`. Pick a variant: `default`, `gold`, `destructive`, `outline`, `secondary`, `ghost`.
- **Choices are option blocks, not pills.** A set of choices is a row of squared blocks. The chosen one is a solid fill. See `pillClass` in `BusinessModellerDetail.tsx`.
- **Custom solid controls** (tiles, option blocks, stat blocks) add the `btn-edge` class so they share the same tactile edge.
- **Tap targets are at least 40px** in their smallest dimension unless space truly does not allow it.
- **Every control has a pressed state.** The global styles dim any button while it is pressed. Do not remove that.

## Layout

- **Today widgets use `TdHead`** for their header: a solid band in the widget's own colour from `TODAY_WIDGET_COLORS`. Do not hand build a widget header with an emoji and a grey label.
- **Pages use `FeaturePageShell`.** It provides the back row, the large title and the ruled header.
- **Section cards have a solid header band** with the `band` class, then the content. Do not repeat the section title inside the body.
- **Key numbers are stat blocks:** a solid jewel or status coloured block with a small uppercase label and a large `font-display` number.
- **Empty states explain and invite.** Use a solid coloured header, a short line of what to do, and a real `Button`.
- **Tables** have a solid dark header row, alternating row fills and right aligned `tabular-nums` figures.
- **Phone first.** Check every screen at 390px wide. Nothing may scroll sideways.

## Fit, do not scroll

When a small fixed area holds a set of buttons or tiles, all of them must be visible without scrolling, however many there are.

- Measure the area and size each item in explicit pixels. Use `FitTileGrid` in `src/components/widgets/FitTileGrid.tsx` (the maths is in `src/lib/quickLinkGrid.ts`). Both quick links widgets use it: the home tile one and the Today one.
- Shrink in this order: smaller tiles, one line labels, then icon only with the label kept as `title` and `aria-label`.
- Do not rely on `flex-1`, `min-h-0` and `fr` rows nested several levels deep to share out height. That has produced overlapping tiles here before.

## Motion

Use motion on purpose: a short entrance for new content, a press on tap, a colour change on selection. Keep it under 200ms for controls. Do not animate things that just sit there.

## Changing behaviour

- A request to restyle is a request to change classes and markup only. Do not change data, logic, routes or copy meaning unless asked.
- Money and projection maths live in `src/lib` and have tests in `src/test`. If you change the maths, change the tests in the same piece of work and run them.

## How to check your work

1. Run `npm test` and `npm run build`.
2. Look at the real screen at 390px and at desktop width. The `/dev/...` preview routes in `src/App.tsx` open without signing in.
3. When you test a layout fix in isolation, reproduce the real parent containers. A simplified wrapper has hidden real bugs here before.
4. Say plainly what you checked and what you could not check.
