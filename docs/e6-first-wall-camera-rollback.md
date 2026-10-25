# First-wall camera restoration

The displayed camera and line/dot positions are restored from commit e8abe7e, immediately before multiple wall crossings were introduced. This includes the original weighted tensor eigenframe, independent eigenaxis phase correlations, affine projection, line anchors, and radial offscreen markers.

The current solver, chamber paths, beta controls, amber wall buttons, signed line hue cues, intrinsic y glyph coefficients/magnitudes/projector targets, and slider snap easing remain. The own-line and paired-boundary marker overrides are absent, so offscreen dots again use the historical radial indicator.

This is an intentional visual rollback accepting jumpiness: repeated eigenvalues, vanishing phase anchors, affine infinities, and eigenaxis exchanges can again cause defects or discontinuities. Later camera-continuity, own-line boundary-marker, and paired-boundary-marker tests describe superseded contracts and are retained as diagnostics; they are not acceptance gates for this restoration. No continuity redesign is claimed.

Run node tests/validate-first-wall-camera.mjs for exact historical frame, point, raw-point, line, marker, and guide comparisons on representative default, first-hop, and multihop chamber samples. The frozen reference is tests/fixtures/first-wall-camera.js from e8abe7e. Colors and y glyphs are intentionally excluded from that historical comparison.
