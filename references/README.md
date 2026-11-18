# References

The format is modelled on low-poly 3D "what if" story reels (e.g. Instagram @lecuden_). Reels downloaded for study go in `references/videos/` and frame grabs in `references/frames/`; both are git-ignored because the content belongs to its creator.

Download for local study (needs `yt-dlp`):
```bash
python -m yt_dlp -o "references/videos/%(id)s.%(ext)s" https://www.instagram.com/reel/<id>/
```
What we measured from them is in `skills/whatif-video/docs/01-style-bible.md`.
