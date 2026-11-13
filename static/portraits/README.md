# Bundled fictional portrait sources

`fictional-adults-v1.png` was generated with the built-in `image_gen` tool on
2026-11-13. It contains 20 fictional adult portraits in a 5-column, 4-row atlas.
No third-party photo service or user photos are used at runtime.

The browser crops each cell and applies small brightness, scale, translation,
and rotation changes. Each identity has only one source photo. Regeneration
reuses these 20 identities; these augmentations are suitable for checking face
detection and grouping behavior, not for measuring recognition accuracy across
independent photos. Kanana device behavior must be checked separately.

Generation prompt (verbatim):

```
Use case: photorealistic-natural. Asset type: a single texture atlas for a browser face-detection QA test dataset. Create ONE precisely aligned contact sheet of exactly 20 DIFFERENT fictional adult identities, exactly 5 columns and 4 rows of equal square photo cells, no margins, no gutters, no borders. Target 2560 by 2048 pixels (each square cell 512 by 512). Each cell is a realistic front-facing passport-like head-and-shoulders PHOTO, with one adult, complete head and hair visible, both eyes clearly visible looking at camera, mouth closed, no glasses, no masks, no hats, no hands. Face occupies about 55 percent of the cell height, centered horizontally and vertically with forehead/chin fully inside the cell. Smooth neutral light gray background, even natural studio light, sharp skin texture, unmistakably real photographic appearance, not cartoon, not illustration, not 3D. Twenty clearly distinct faces, diverse adult ages 25 to 65, balanced men and women, varied hair styles, facial structure and skin tones including East Asian, South Asian, Black and European appearance. Different modest plain shirts. Every photo must be centered independently within its exact cell. No text, numbers, names, labels, watermarks, logos or decorations. These are entirely fictional non-famous people.
```
