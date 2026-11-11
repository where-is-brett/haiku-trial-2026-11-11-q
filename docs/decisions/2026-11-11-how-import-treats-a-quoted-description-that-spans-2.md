<!-- docs/decisions/2026-11-11-how-import-treats-a-quoted-description-that-spans-2.md -->
# How /import treats a quoted description that spans two lines

- **Date:** 11 November 2026
- **Piece:** statement-import
- **Options:** A. Refuse a row whose description holds a line break, and name its line (A statement with a two-line description is refused until it is cleaned up; Can be undone) · B. Accept two-line descriptions, and accept that a stray quote can hide rows with no error (None now; a stray quote can silently drop rows; Can be undone)
- **Recommended:** refuse
- **Chosen:** refuse
- **The director's words:** none
