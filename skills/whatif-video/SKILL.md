---
name: whatif-video
description: Create 45-80 second vertical (9:16) low-poly 3D "What if…?" story shorts in the style of LECUDEN-type channels, rendered three times with identical visuals and English captions but English, Telugu and Hindi narration (watermarks @bhuvi.explains.en / .te / .hi). Use when asked to make, script, storyboard, translate, render or improve a "what if" video, reel or short, or to add a new topic to the bhuvi.explains channels.
---

# What-If Video Skill

You turn **one "What if…?" idea** into **three finished 1080×1920 MP4s** (en / te / hi). You only write **one file**, `videos/<slug>/storyboard.json`, containing every scene's narration in all three languages plus what happens on screen. The engine does the voices, captions, 3D animation, counter, music, sound effects, watermark, CTA and rendering.

---

## When the user just gives an idea (or asks for "N more videos")

Do the whole job without asking further questions:
1. Pick or sharpen the idea with the checklist in `docs/02-story-writing.md` §1. If asked for several, make each one different in setting, counter and twist.
2. Make a slug (`pause-time`) and run `python engine/make_video.py new videos/<slug>`.
3. Write the English story first (12 beats, `docs/02`), then the Telugu and Hindi lines (`docs/03`), then the visuals (`docs/04`), all inside `storyboard.json`. Copy patterns from `videos/lie-shrinks-you/storyboard.json` and the other sample topics.
4. `python engine/make_video.py validate videos/<slug>` → fix until `0 error(s)`.
5. `python engine/make_video.py voice videos/<slug>`, then run the anchor check (`docs/05` §4) and fix any missing anchor words.
6. `python engine/make_video.py preview videos/<slug> --lang en`. Open `videos/<slug>/build/preview_en.jpg` and check it against `docs/06` section B. Fix and re-preview.
7. `python engine/make_video.py render videos/<slug>` → `output/<slug>/<slug>_{en,te,hi}.mp4`.
8. Run the final QA (`docs/06` section C), write `videos/<slug>/script.md` (`python engine/make_video.py script videos/<slug>`), and reply with the three paths, durations and a 2-line summary.

## The non-negotiables

1. **Format**: flash-forward tease (2 scenes) → "What if…" hook with title card → escalating day (5-7 scenes) → curiosity line ("And wait till you see…") → twist → payoff → ending question with title → `{cta}` scene. See `docs/02` §2.
2. **Length**: English 45-60 s (about 120-150 narration words). Telugu/Hindi naturally run 15-30 % longer; that is fine.
3. **Every scene changes something you can see**: counter, size, age, position, bubble, set or camera. A number spoken in the story appears on the counter **on that word**.
4. **Same visuals and English captions in every language.** Only `say.te`, `say.hi` and `anchors` differ.
5. **Telugu and Hindi must sound spoken, not written**: casual words, common English loanwords, numbers written as words in Telugu (`docs/03`).
6. **Never change the hero, voices, handles or layout per video.** They live in `engine/runtime/person.js` (`HERO`), `engine/config.json` and `engine/runtime/style.css`.
7. **The validator must pass** before voicing or rendering, and the render log must show no `browser:` errors.

## Workflow

| # | Step | Read | Output |
|---|---|---|---|
| 1 | Idea + beats | `docs/02-story-writing.md` | 12-beat English outline |
| 2 | Translate | `docs/03-translation.md` | `say.te`, `say.hi`, `anchors` |
| 3 | Visuals | `docs/04-storyboard-reference.md` | sets, actors, cameras, counter, props, sfx |
| 4 | Validate + voice | `docs/05-production.md` | `0 error(s)`, all anchors found |
| 5 | Preview + fix | `docs/06-qa-checklist.md` B | `build/preview_en.jpg` looks right |
| 6 | Render + QA | `docs/06-qa-checklist.md` C | 3 MP4s in `output/<slug>/` |

## Scene recipe (memorise)

- 1 scene = 1-3 short sentences, 1-8 s of English speech. 11-14 scenes per video.
- Scene ids: `tease1`, `tease2`, `hook`, story scenes…, `outro`, `cta`.
- Cues (`"at"`) are **English words** from that scene's `say.en` (`"Snap"`, `"169"`, `"wait"`), `"start"`, `"end"`, a fraction `0..1`, or `word#2` for the 2nd occurrence.
- Use 1-3 camera shots per scene (`shots`): full/wide to set up, then close/medium on the reaction word.
- Counter colours carry meaning: green = normal/good, red = loss/danger, yellow = extreme, gray = neutral.
- Put a sound effect on every visual change: `shrink`/`grow`/`age` for the main effect, `whoosh` on scene starts, `pop` for things appearing, `thud` + `shake` for impacts, `rewind` + `flash` on tease2.

## Commands (from the repository root)

```bash
source .venv/bin/activate                        # Windows: .\.venv\Scripts\Activate.ps1
python engine/make_video.py new      videos/<slug>
python engine/make_video.py validate videos/<slug>
python engine/make_video.py voice    videos/<slug>          # cached; --force to redo
python engine/make_video.py anchors  videos/<slug>          # every anchor word found in TTS output?
python engine/make_video.py preview  videos/<slug> --lang en
python engine/make_video.py render   videos/<slug> [--lang en,te,hi] [--fast]
python engine/make_video.py script   videos/<slug>          # writes script.md (narration table)
python engine/make_video.py catalog                         # after editing the runtime
```

## Reference material
- `videos/lie-shrinks-you/`, `videos/phone-ages-you/`, `videos/hear-thoughts/`, `videos/laugh-float/`: four complete storyboards with `script.md`. Copy their patterns.
- `templates/storyboard.template.json`: a skeleton with all 12 beats.
- `engine/catalog.json`: the exact allowed sets, spots, actions, props, presets and sfx.
