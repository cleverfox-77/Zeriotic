# Zeriotic site design

## Concept
One continuous building the visitor walks through by scrolling. Every object means something:

- **The Gate**: the studio mark (circle, square, diagonal) at architectural scale. The square swings open as a door.
- **The Answers hall (OctaDezx)**: speech bubbles pass through an octahedron. Good replies leave ember, rejected ones sink.
- **The Circuit (Accert One)**: a wet start line at dusk. The lights come on with the scroll, go out, and the car launches.
- **The Vault (Security)**: rings are layers of defence. Beams probe it, then it opens.
- **The Gallery (client projects)**: a quiet arcade.
- **The second Gate (contact)**: the same mark at golden hour.

## Rules
- Everything 3D is generated in code. No model files ship, and no game asset is ever used on the site.
- Light changes between rooms by blending moods in `src/world/studio/Atmosphere.js`.
- Text ink follows the light through `data-ink` (`ink` for bright rooms, `paper` for dark ones).
- Camera stops, moods and page anchors live together in `STOPS` in `src/story/Scroll.js`.

## Content rules
- Describe results and experiences, never how a project is built. No stacks, engines, protocols, tool names or internal codenames.
- No em or en dashes in visible copy.
- Do not describe the studio as small, selective or by headcount, and do not claim work is never subcontracted or always in-house. It takes on almost every type of software work.
- Accert One copy follows the game's own rules: no real teams, brands, circuit names or the F1 name.
- OctaDezx figures come only from its published benchmark, with the caption that it is synthetic and not head-to-head.

## Type and colour
Inter Tight only, on every page, with no serif or monospace accents. Regular weight for display, tracking around -0.025em. Ivory `#F5EFE9`, ink `#212121`, ember `#FF5500`.

## Run
`npm run dev` (port 5180), `npm run build` to produce and verify `dist/`.

## Performance rules
- Keep the number of lights constant. Adding or hiding one rebuilds every surface shader, which shows up as a stutter.
- Compile shaders for the HDR scene target, not the screen.
- No `backdrop-filter` or `mix-blend-mode` over the canvas. Use a more opaque panel instead.
- Matte surfaces use Lambert. Standard and Physical are for metal and the car only.
- Search copy lives in each page's JSON-LD and visible FAQ. They must match word for word, and `npm run build` fails if they do not.
