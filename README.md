# What-If Video Skill: low-poly 3D "What if…?" shorts in English, Telugu and Hindi

Give it **one "What if…?" idea** and you get **three finished 1080×1920 vertical MP4s** (Instagram Reels / YouTube Shorts) with identical visuals and English captions. Only the narration changes: English, Telugu or Hindi. Each one is watermarked for its channel:

| Language | Voice (Microsoft Edge neural) | Watermark / CTA |
|---|---|---|
| English | `en-US-AvaMultilingualNeural` | `@bhuvi.explains.en` |
| Telugu | `te-IN-ShrutiNeural` (spoken-style script) | `@bhuvi.explains.te` |
| Hindi | `hi-IN-SwaraNeural` | `@bhuvi.explains.hi` |

The style is modelled on low-poly 3D "what if" story channels (e.g. LECUDEN): a flash-forward hook, a big "WHAT IF…" title, a live counter pill, 1-3-word captions, many short camera cuts, a twist, and an ending question. Characters, sets, music and sound effects are all **generated from code**, so there are no third-party assets to license.

| Sample topics (in `videos/`) | |
|---|---|
| `lie-shrinks-you` | What if every lie made you 1 cm shorter? |
| `phone-ages-you` | What if you aged 1 year every time you checked your phone? |
| `hear-thoughts` | What if you could hear everyone's thoughts for one day? |
| `laugh-float` | What if every laugh made you float 1 metre up? |

---

## 1. Install (once per machine)

Requirements: **Python 3.10+**, git, internet (Edge TTS is an online service). No GPU needed.

```bash
git clone https://github.com/bhuvanchandmaddi/whatif-video-skill.git
cd whatif-video-skill
./setup.sh                 # Windows: powershell -ExecutionPolicy Bypass -File setup.ps1
```
Setup ends with `SETUP OK`.

> **Corporate TLS proxy?** The TTS client trusts both certifi and the OS certificate store, so most proxies work as they are.

## 2. Make a video with your AI assistant

Open this folder in your agent (VS Code + Copilot, Claude Code, Cline, …) and say:

> Read `skills/whatif-video/SKILL.md` and follow it. Idea: **What if you could pause time for 10 seconds a day?**

The agent writes `videos/<slug>/storyboard.json` (narration in all three languages), validates and previews it, then renders. Videos appear in **`output/<slug>/<slug>_{en,te,hi}.mp4`**.

## 3. Or run the commands yourself

```bash
source .venv/bin/activate                                   # Windows: .\.venv\Scripts\Activate.ps1
python engine/make_video.py new      videos/pause-time      # copies the storyboard template
python engine/make_video.py validate videos/pause-time      # must say 0 error(s)
python engine/make_video.py voice    videos/pause-time      # TTS for en/te/hi (cached)
python engine/make_video.py preview  videos/pause-time --lang en   # build/preview_en.jpg
python engine/make_video.py render   videos/pause-time      # all three languages
python engine/make_video.py render   videos/pause-time --lang te --fast   # quick 540p draft
```
On a 4-core CPU, a 60-second video renders in about 9-12 minutes per language.

---

## Folder structure

```
skills/whatif-video/            THE SKILL: give this to the AI
  SKILL.md                      entry point and workflow
  docs/01-style-bible.md        what the format is and why
  docs/02-story-writing.md      idea selection, 12-beat structure, word limits
  docs/03-translation.md        natural spoken Telugu / Hindi + anchors
  docs/04-storyboard-reference.md   every storyboard field, sets, spots, actions, props, cameras
  docs/05-production.md         commands, voices, timing model, troubleshooting
  docs/06-qa-checklist.md       quality gate before a video is "done"
  templates/                    storyboard template (12 beats)
engine/
  make_video.py                 pipeline: validate -> voice -> timeline -> audio mix -> render
  audio.py                      Edge TTS, pause trimming, procedural music + 17 SFX
  config.json                   voices, speed, handles, CTA lines, caption limits
  catalog.json                  generated list of sets / spots / actions / props / sfx (validator uses it)
  runtime/                      three.js scene runtime (characters, sets, props, camera, overlays)
  tools/                        set gallery, pose test, screenshot helpers
videos/<slug>/                  storyboard.json + script.md per topic (build/ is cache)
output/<slug>/                  FINAL VIDEOS (git-ignored)
references/                     notes on the reference style (reels themselves are never committed)
```

## Consistency guarantees

- **Hero**: one definition, `HERO` in `engine/runtime/person.js` (teal hoodie, yellow badge, yellow sneakers). Storyboards may only pose him, give him expressions or temporary look overrides (e.g. grey hair when ageing).
- **Voices, handles and CTA**: fixed in `engine/config.json`.
- **Layout**: title, counter, captions, watermark and CTA positions live in `engine/runtime/style.css`.
- **Sync across languages**: cues are written against English words. Each language's scene is stretched to its own narration, and `anchors` lock important cues to the matching Telugu/Hindi word.

## Credits and licences

Rendering: [three.js](https://threejs.org) (MIT) in headless Chromium via Playwright · Voices: Microsoft Edge online neural TTS via [edge-tts](https://github.com/rany2/edge-tts) (LGPL-3.0) · Fonts: Luckiest Guy (Apache-2.0), Anton, Inter, JetBrains Mono (SIL OFL) · Music and SFX: generated procedurally. Reference reels belong to their creators and are not included.
