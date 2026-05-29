# Design Taste Notes

Reference skill:
- https://github.com/Leonxlnx/taste-skill
- Installed skill name: `design-taste-frontend`

## Design Read

This project is a playful consumer web app for mobile-first social sharing.
The visual language should stay dark, friendly, clear, and shareable rather than corporate or dashboard-like.

## Dials

- DESIGN_VARIANCE: 6
- MOTION_INTENSITY: 4
- VISUAL_DENSITY: 4

## Rules For This Project

- Keep the main flow obvious: upload photo, view result, save/share result, comment.
- Prioritize mobile thumb ergonomics. Primary CTAs should be large and easy to hit.
- Use one dark theme across the whole app.
- Keep one accent family: yellow and mint may be used together because they are already the app identity.
- Avoid generic AI-looking purple gradients.
- Avoid adding cards inside cards unless the section genuinely needs grouping.
- Loading states should match the final layout shape, not use generic spinners.
- Empty, loading, success, and error states should all be present for interactive areas.
- Button labels must stay on one line and maintain strong contrast.
- Do not add decorative UI that competes with the result, upload, and sharing flow.
- For redesign work, audit the current UX first, then make targeted improvements.

## Preflight Before Shipping

- Upload flow is understandable without explanation.
- Result and sharing controls are disabled until a result exists.
- Mobile layout does not squeeze titles or wrap button labels awkwardly.
- CTA contrast is readable.
- Comments have loading, empty, and error states.
- Reduced or simple motion is preferred over flashy motion.
- Build passes with `npm run build`.
