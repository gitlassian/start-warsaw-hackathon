# Surface: Login (`web/app/login/page.tsx`)

Mode: Persuade. Primary visitor: a guest who just scanned the host's QR (`/login?next=/join/<CODE>`), mid-event, on a phone. Secondary: a host arriving directly.

## Direction contract

THESIS: The login is the party table after everyone's dumped their prints on it: a pile you want to add to. Refuses the category default of logo + tagline + centred sign-in button.

OWN-WORLD: The app's monochrome world as a tabletop: `--surface` gray ground with two faint strips of 35mm film drifting under the pile in opposite directions (fade out behind the copy), white prints with an even border (no captions) and soft offset shadows, tossed at angles. Photos (the event cover plus stock party prints) are the only colour on screen. System sans, heavy tight display line; our own primary pill "Continue with Google" (no Google iframe).

STORY: "Something is happening, people are already in it, my photos belong there." Guest sees the real event (cover, title, date, real photo count), then signs in with one tap and lands on the join screen.

FIRST VIEWPORT: Wordmark top-left. Upper ~55%: the pile, a stack of nine unnumbered, uncaptioned stock party prints (five layers visible) (Unsplash License, user-approved) under the cover print, tilted and shaded by depth, the event cover on top. The event title sits in bold at the start of the date line. Below: display headline (two lines on desktop, three on phones at 40px) with the real count ("148 photos on the pile. / Throw yours on."), date line, Google button in the thumb zone; no fine print. No event: same pile, generic copy, a fourth stock print on top.

FORM: The Pile, position 6 on the ordered list. seed:e0ebeb82df1a7a24

SIGNATURE: Prints drop onto the table one after another on load (scale + fall + settle, exponential ease-out, cover last). The pile flips itself every 1.5s: top print slides off right, tucks under, settles at the bottom. Tap flips sooner; hover/focus pauses. Reduced motion: static pile, no auto-flip.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
