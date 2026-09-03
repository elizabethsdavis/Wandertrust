# App icon source

`emoji_u1f9f3.svg` is the 🧳 *luggage* glyph from Google's **Noto Emoji**
(https://github.com/googlefonts/noto-emoji, Apache License 2.0), used as a
vector so the Home Screen icon stays crisp at every size.

Regenerate the icon set (writes into `public/`):

    python3 scripts/make-icons.py                       # default 🧳
    python3 scripts/make-icons.py path/to/other.svg     # any square SVG

To switch emoji, download `svg/emoji_u<codepoint>.svg` from the Noto Emoji
repo (e.g. `emoji_u2708.svg` for ✈️), drop it here and pass its path.
