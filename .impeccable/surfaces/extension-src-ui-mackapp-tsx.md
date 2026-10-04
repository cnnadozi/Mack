---
version: 1
slug: "extension-src-ui-mackapp-tsx"
primary_target: "extension/src/ui/MackApp.tsx"
related_targets: ["extension/src/ui/styles.ts"]
---

# Simplified view and guide panel

Scope: the full-screen simplified view (`MackApp` simplified mode) and the guide panel over original pages (`OriginalPanel`). Mack's floating bar is out of scope.
Mode: operate.

Audience and job: older adults, and anyone lost on a busy site, who want one task done on the real site. They read the next step, press it, or ask Mack by voice; Mack's yellow highlight shows where.
Constraints: keep the yellow "Next step" highlight, the site's logo (or name) in the header, and the large sizes (labels about 24px, task buttons at least 64px, nothing essential under 20px). WCAG 2.2 AA. Light and dark. Right-to-left. Model output only picks content; the look is ours.
Avoid: anything template-looking or AI-generic.
Identity (open in PRODUCT.md): this direction answers it as Mack's box holding the site's own colour: the lid and the divider tabs carry the site's brand colour.

## Direction contract

THESIS: Every site becomes a box of task cards with the one to do now already pulled up. Refuses the category default: a tinted page of same-size rounded icon-tile cards with soft shadows.
OWN-WORLD: Flat white card stock on a cool grey tin interior, every grey one step of a fixed ramp; ink near-black; one red top rule marks the pulled-up card; divider tabs and the lid strip in the site's brand colour; plain line icons with no tiles; hairline borders, no soft shadows; yellow highlight ring unchanged.
STORY: The visitor sees which site they are on, reads one big card that says what to do next, and finds everything else filed under clearly named tabs; when Mack points, the rest of the box dims.
FIRST VIEWPORT: A full-width lid strip in the site colour holds the site logo on its white chip, the page title, the controls and, when searching is the page's main job, the site search row. Below, Mack's instruction as plain words leading into the pulled-up next-step card, full column width, large label, red top rule, arrow. Then the box: sections filed behind staggered divider tabs, each tab naming the section, cards as full-width rows in one centred column. More options is the back of the box, collapsed.
FORM: Recipe card box (kitchen index-card box with tabbed dividers), position 6 of 7 on the ordered list, seed key 5b70de0c. Raises: fixed tonal ramp (exposure record), one reading spine (labanotation), shared card scale and baseline (botanical folio), strict row grid (Crouwel), dim the rest on focus (streaming wall).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
