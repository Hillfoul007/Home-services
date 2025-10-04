Generate app icons and adaptive icons

The repository includes the source SVG at `public/laundrify-exact-icon.svg` and a helper `scripts/generate-icons.js` listing required sizes.

Requirements
- rsvg-convert or ImageMagick (convert)

Example commands (using rsvg-convert):

mkdir -p public/icons
rsvg-convert -w 512 -h 512 public/laundrify-exact-icon.svg -o public/icons/icon-512x512.png
rsvg-convert -w 192 -h 192 public/laundrify-exact-icon.svg -o public/icons/icon-192x192.png
rsvg-convert -w 144 -h 144 public/laundrify-exact-icon.svg -o public/icons/icon-144x144.png
rsvg-convert -w 96 -h 96 public/laundrify-exact-icon.svg -o public/icons/icon-96x96.png

Or ImageMagick (convert):
convert public/laundrify-exact-icon.svg -resize 512x512 public/icons/icon-512x512.png

Adaptive icon (Android)
- Create `foreground.png` (transparent parts) and `background.png` (solid square) and include them under `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` and the mipmap-* folders for legacy icons.

ic_launcher.xml example:

<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@mipmap/ic_launcher_background" />
  <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>

Place generated PNGs into the appropriate `mipmap-*/` folders. For Play Store you will also need a 512x512 high-res icon and a 1024x500 feature graphic.

Use `scripts/generate-icons.js` to view the required sizes list.
