# Introductory quivers

Run `bash tools/diagrams/build.sh` or `node tools/diagrams/build.mjs` from any directory. Requires Node 12+, pdflatex with standalone/TikZ, and pdftocairo. The standalone class crops the PDF, replacing the separate pdfcrop step used by the gift-exchange diagrams. No package installation is performed.

The three LaTeX sources preserve the left/right/upper branches and dimensions in the star-shaped quiver slides. Indexed x arrows point toward the central vertex and y arrows point away. There is no framing vertex. The central symmetry is SL(3), SL(4), or SL(6), respectively; all other vertex symmetries are GL. Light and dark SVGs use transparent backgrounds and outlined LaTeX glyphs.

After rebuilding images, run `node tools/build-single.mjs` to embed all six images in the single-file download.
