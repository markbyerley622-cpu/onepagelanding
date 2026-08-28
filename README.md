# DRK — Get Liquid.

A single full-screen composition: one floating sheet of smoked glass on a
near-black ground, left content / right category rail, and a WebGL surface that
behaves like dark liquid.

No build step, no dependencies. Open `index.html`, or serve the folder.

```
index.html    composition and copy
styles.css    DRK design tokens, layout, glass, motion
liquid.js     the liquid-glass shader (one draw call)
```

## The surface

`liquid.js` runs a single fragment shader over the whole panel:

- a **domain-warped flow field** (three soft octaves, heavily stretched on x)
  builds a height field — a swell, not a texture
- the height field is **lit as black chrome over water**: a sharp white key for
  the glints, a broad grey sheen, a green transmission light, and a Fresnel rim
  for the luminous glass edge
- the DRK signal green (`#00e060`) is confined to **one diagonal sweep** rising
  to the right, riding the crests. It is a signal, never a wash.

## Cursor

- **parallax** — the field drifts against pointer position
- **lens** — a soft optical press under the cursor, as if the glass has weight
- **ripples** — three slots of decaying radial waves, emitted on click and on
  sustained movement, so the surface holds a wake
- **the category rail bends the light** — hovering a category pulls the green
  sweep toward that row

## Performance

- one triangle, one draw call, no libraries
- renders below native resolution (0.84× desktop, 0.62× touch) and upscales;
  the surface is soft by nature so the saved fill rate costs nothing visible
- **auto-degrades**: if frames run long, resolution drops rather than motion
- pauses on tab hide
- `prefers-reduced-motion` renders a single still frame — the composition,
  none of the movement

## Responsive

Mobile keeps the single-panel concept. The panel goes full-bleed, the category
rail becomes a list inside the same glass, and the shader relaxes its left-hand
masking so the sheet still reads across a narrow viewport. It never becomes a
conventional stacked website.
