---
name: RollCall
description: One shared photo roll for every event.
colors:
  bg: "#ffffff"
  surface: "#f4f4f4"
  line: "rgb(0 0 0 / 0.08)"
  fg: "#0d0d0d"
  muted: "#5d5d5d"
  faint: "#737373"
  scrim: "rgb(0 0 0 / 0.4)"
  bg-dark: "#212121"
  surface-dark: "#2f2f2f"
  line-dark: "rgb(255 255 255 / 0.1)"
  fg-dark: "#ececec"
  muted-dark: "#b4b4b4"
  faint-dark: "#9b9b9b"
  scrim-dark: "rgb(0 0 0 / 0.6)"
  print-paper: "#ffffff"
  print-ink: "#0d0d0d"
  print-blank: "#e5e5e5"
  viewer-black: "#000000"
typography:
  display:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "26px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 600
  body:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  code:
    fontFamily: "ui-monospace, \"SF Mono\", Menlo, Consolas, monospace"
    fontSize: "1.5rem"
    fontWeight: 400
    letterSpacing: "0.3em"
rounded:
  print: "0.375rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  sheet: "1.75rem"
  pill: "9999px"
spacing:
  hairline: "2px"
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  gutter: "1.25rem"
  lg: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.fg}"
    textColor: "{colors.bg}"
    rounded: "{rounded.pill}"
    padding: "0 1.25rem"
    height: "3rem"
  button-secondary:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.pill}"
    padding: "0 1.25rem"
    height: "3rem"
  button-icon:
    textColor: "{colors.fg}"
    rounded: "{rounded.pill}"
    size: "2.75rem"
  button-icon-active:
    backgroundColor: "{colors.surface}"
  field:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1rem"
    height: "3rem"
  sheet:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.sheet}"
    padding: "0.5rem 1.25rem 1.25rem"
    width: "32rem"
  list-row:
    rounded: "{rounded.md}"
    padding: "0.5rem"
  list-row-active:
    backgroundColor: "{colors.surface}"
  print:
    backgroundColor: "{colors.print-paper}"
    textColor: "{colors.print-ink}"
    rounded: "{rounded.print}"
    width: "min(56%, 15rem)"
  viewer:
    backgroundColor: "{colors.viewer-black}"
    textColor: "{colors.bg}"
---

# Design System: RollCall

## Overview

**Creative North Star: "The Gray Table"**

RollCall is a quiet monochrome phone app in the spirit of ChatGPT's interface: white (or near-black) ground, one black pill for the action that matters, hairline borders, soft rounded corners, system type. The chrome has no colour of its own, so the only colour anywhere is in people's photos. The interface is the table and the photos are what lands on it.

Density is phone-native and one-handed. Content sits in one column no wider than 32rem. Primary actions are pinned in the thumb zone above the home indicator, and the edges respect the safe areas. Depth comes from flat tonal steps (`bg` to `surface`) and 1px lines, never from shadows on chrome. The one material exception is the print: a white paper photo with a real soft shadow, used where the product wants to feel like a pile of shared photos.

Light and dark follow the system setting. Each token has a dark twin, and nothing is hard-coded to one scheme except the print paper, the full-bleed photo viewer and the QR plate, which need to stay white or black whatever the scheme.

**Key Characteristics:**
- Black / white / gray chrome only; photos carry all colour.
- 9999px pills for actions, 1rem to 1.75rem radii for containers.
- 1px hairlines at 8% (light) / 10% (dark) alpha.
- System sans everywhere; system mono only for join codes.
- One motion curve, exponential ease-out, switched off under reduced motion.
- Mobile-first single column (max 32rem), safe-area aware, thumb-zone actions.

## Colors

A strictly achromatic palette with paired light and dark values. The frontmatter's `-dark` keys are the dark-mode twins of the same roles, switched by `prefers-color-scheme`.

### Primary
- **Ink** (`fg`): text, icons, the focus ring, and the fill of the primary pill. In dark mode it inverts to a soft off-white, so the primary pill turns white on near-black.

### Neutral
- **Paper White** (`bg`): page ground, the sheet, fields, the secondary button, the sticky bars. Matches the `theme-color` meta so the browser chrome melts in.
- **Table Gray** (`surface`): the pressed state for icon buttons and list rows, image placeholders, skeletons, empty cover slots, and the login tabletop.
- **Hairline** (`line`): every border and divider: fields, secondary buttons, the sheet edge, cover images, the bottom bar's top rule.
- **Graphite** (`muted`): secondary text, metadata lines, date lines; also the focus border on fields.
- **Ash** (`faint`): placeholders and empty-state glyphs.
- **Scrim** (`scrim`): the backdrop behind the bottom sheet.
- **Print Paper / Print Ink / Print Blank** (`print-paper`, `print-ink`, `print-blank`): fixed values for the print, which is physical paper and stays white in both schemes.
- **Viewer Black** (`viewer-black`): the full-screen photo viewer, black in both schemes so photos read true.

### Named Rules
**The Photos Are The Only Colour Rule.** No hue goes into chrome, ever: no accent, no tinted state, no coloured badge. If something needs emphasis, use Ink, weight, or the black pill. Colour on screen comes from user photos (and, on the login pile, licensed stock prints).

**The Twin Token Rule.** Every chrome colour comes from a token with a dark twin. A literal value is only allowed for objects that are physically the same colour in both schemes (print paper, viewer, QR plate).

## Typography

**Display Font:** system sans (`ui-sans-serif, -apple-system, ...`)
**Body Font:** the same system sans
**Label/Mono Font:** system mono (`ui-monospace, "SF Mono", Menlo, ...`), for join codes only

**Character:** One native family, so it reads like part of the phone. Hierarchy comes from size and weight, with tight tracking only at the large sizes.

### Hierarchy
- **Display** (700, 40px, 1.02, -0.035em, balanced): the heavy, tight persuasion headline on the login. Two lines on desktop, three on phones.
- **Headline** (600, 26px, tight leading, -0.025em, balanced): event titles on the event and join screens.
- **Title** (600, 17px; 18px / 600 in sheets): the TopBar title, sheet headings, empty-state leads (18px / 500).
- **Body** (400, 1rem): the default. Inputs are 16px so iOS does not zoom on focus.
- **Label** (400–500, 0.875rem): metadata, fine print.
- **Code** (mono, 24–30px, 0.3em tracking, uppercase): the six-character join code shown and typed.

### Named Rules
**The Native Voice Rule.** Use the system stacks only. Get emphasis from weight (500 / 600 / 700), not from a second family.

## Layout

A single column centred at max 32rem (`max-w-lg`) and filling the dynamic viewport height (`min-h-dvh`). Gutters are 1rem in lists and bars and 1.25rem on the login and in sheets. A sticky TopBar (3.5rem tall, under the top safe area) carries a back chevron, a truncated title, and optional trailing actions. Primary actions live in a fixed BottomBar pinned above the home indicator, `max(0.75rem, safe-area-inset-bottom)`, with a hairline top rule and a 7rem spacer so content is never covered. Photo grids are three columns with a 2px gap and square cells. Every inset that meets a screen edge accounts for `env(safe-area-inset-*)`.

The vertical rhythm is small steps: 0.5rem, 0.75rem, 1rem, 1.25rem and 1.5rem between groups.

## Elevation & Depth

Chrome is flat. Depth is tonal (`surface` under `bg`) plus 1px hairlines, and pressed states darken to `surface` rather than lifting. Shadows exist only on things that physically float over the page.

### Shadow Vocabulary
- **Popover** (`box-shadow: 0 8px 24px rgb(0 0 0 / 0.12)`): the account menu, the one floating menu in the app.
- **Print** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.08), 0 14px 32px -10px rgb(0 0 0 / 0.3)`): a paper print resting on the table. A soft contact shadow plus a diffuse drop.
- **Print in flight** (`box-shadow: 0 40px 60px -10px rgb(0 0 0 / 0.25)`): the start of the drop animation, before the print lands.

### Named Rules
**The Flat Chrome Rule.** Buttons, fields, cards and bars never cast shadows. Only popovers and paper prints do.

**The Shaded Paper Rule.** On a pile, lower prints dim the photo only (brightness 0.86 / 0.91 / 0.96 / 1 by depth). The white paper border is never shaded.

## Shapes

Soft and round. Actions and avatars are full pills (9999px). Containers step up with size: 0.75rem for thumbnails and menu items, 1rem for fields, list rows and menus, 1.5rem for cover images and the QR plate, 1.75rem for the bottom sheet's top corners. The print is the only near-square object (0.375rem), because it is paper. Cover images get a hairline border so they don't bleed into the ground.

## Components

### Buttons
Quiet, tactile, and big enough for a thumb.
- **Shape:** full pill (9999px), 3rem tall, 1.25rem side padding, 500 weight at 1rem.
- **Primary:** Ink fill with Paper text. One per view, in the thumb zone.
- **Secondary:** Paper fill, Ink text, hairline border.
- **Icon:** a 2.75rem round hit area with no fill at rest, filled with `surface` when pressed (white/10 on the viewer). Lucide icons at 24px, stroke 1.75.
- **Press / Focus:** press scales to 0.97 over 0.2s on the expo curve. Focus is a 2px Ink outline offset 2px. Disabled drops to 40% opacity.
- **Google sign-in:** our own primary pill ("Continue with Google") with Google's four-colour G on a 24px white chip; it opens Google's token popup. Google's iframe button is not used, so the CTA follows the theme like every other primary.

### Inputs / Fields
- **Style:** Paper ground, hairline border, 1rem radius, minimum 3rem tall, 0.75rem by 1rem padding, 16px text. Grows with its content.
- **Focus:** no outline. The border darkens to Graphite.
- **Code entry:** the same treatment at 4rem tall, 1rem radius, centred uppercase mono with 0.3em tracking.

### Cards / Containers
- **List rows:** 1rem radius, 0.5rem padding, no border, `surface` on press. Leading 3.5rem thumbnail at 0.75rem radius.
- **Cover images:** 3:2, 1.5rem radius, hairline border.
- **Skeletons:** 4rem bars in `surface` at 1rem radius, pulsing unless reduced motion is on.

### Navigation
- **TopBar:** sticky, Paper ground, 3.5rem tall, 17px / 600 truncated title, back chevron as an icon button.
- **BottomBar:** fixed in the thumb zone, max 32rem, hairline top rule, a row of buttons with 0.5rem gaps.

### Bottom Sheet
Built on a native `<dialog>` to get the focus trap and Esc / back handling. Max 32rem wide and 92dvh tall, top corners 1.75rem, hairline edge without a bottom border, padding ending at the bottom safe area. A 2.25rem by 0.25rem pill grabber in `line`. Slides up from 100% over 0.45s on the expo curve while the scrim fades in over 0.3s.

### Viewer
A full-screen `<dialog>`, black in both schemes with white controls, for swiping through originals.

### Print (signature)
A paper photo on the gray table. White paper with an even 3.5% border and no caption; the event title lives in the line under the headline. The photo is a 4:5 card, `min(56%, 15rem)` wide, 0.375rem radius, with the Print shadow. Prints sit in slots set by an offset and a tilt (−14° to +11°) and are shaded by depth. On load they drop in one after another: from 1.18 scale, lifted and turned, settling over 0.7s on the expo curve, staggered 110ms, the top print last. The pile holds ten prints (nine stock party photos plus the event cover), five visible slots deep. Every 1.5s it flips on its own: the top print slides off to the right, tucks under at the midpoint and settles in the bottom slot (0.9s), while the rest glide up a slot over 0.55s. A tap flips sooner; hovering or focusing the pile pauses it. Reduced motion shows a static pile with no auto-flip. The ground under a pile is `surface`, edge to edge.

## Do's and Don'ts

### Do:
- **Do** make the one primary action a black pill (Ink fill, 9999px, 3rem tall) in the thumb zone.
- **Do** draw every border as a 1px `line` hairline (8% / 10% alpha).
- **Do** use `--ease-out-expo` (`cubic-bezier(0.16, 1, 0.3, 1)`) for every transition, and turn it off under `prefers-reduced-motion`.
- **Do** keep touch targets at least 44px (2.75rem) and inputs at 16px.
- **Do** pair every chrome colour with its dark-mode twin.
- **Do** let photos fill their frames (`object-cover`) and keep everything around them gray.

### Don't:
- **Don't** add any hue to chrome: no accent colour, coloured badge or tinted state. Photos are the only colour.
- **Don't** put shadows on buttons, fields, rows or bars. Shadows belong to popovers and prints only.
- **Don't** introduce a second type family or a webfont. Use the system sans, plus system mono for codes.
- **Don't** use sharp corners on chrome. Only the paper print goes near-square (0.375rem).
- **Don't** shade a print's paper border. Depth dims the photo only.
