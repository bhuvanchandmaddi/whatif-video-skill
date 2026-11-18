# 06 · QA checklist

## A. Storyboard (before voice)
- [ ] Validator: `0 error(s)`.
- [ ] Beats in order: tease1, tease2, hook (+title), story, curiosity line, twist, payoff, outro (+title), cta.
- [ ] English 120-150 words; every sentence ≤ 12 words.
- [ ] Every number in the narration has a counter event on that word.
- [ ] Every scene has at least one sfx; tease2 has `flash` + `rewind`.
- [ ] Telugu reads like speech (numbers as words, loanwords kept); Hindi is natural Hinglish.
- [ ] Anchors on every key cue; `anchors` check prints nothing missing.

## B. Preview sheet (`build/preview_en.jpg`)
- [ ] Hero is the hero (teal hoodie, yellow shoes) unless deliberately overridden (aged, etc.).
- [ ] Faces visible in close/medium shots; nobody's back is to the camera in reaction shots.
- [ ] Nothing important hidden behind the title, counter, caption or a wall.
- [ ] Small/large characters are framed so the effect is obvious (use `fit`, `low`/`high`).
- [ ] Thought bubbles readable and not overlapping the counter.
- [ ] Sets change at least 4 times; no two consecutive shots look the same.

## C. Final MP4s (all three)
- [ ] 1080×1920, 30 fps, AAC audio, en 45-60 s.
- [ ] Loudness about −14 to −15 LUFS:
  `ffmpeg -i out.mp4 -af ebur128 -f null - 2>&1 | grep "I:"`
- [ ] Watermark handle matches the language (`.en` / `.te` / `.hi`), CTA card shows the same handle.
- [ ] Listen once per language: no mispronounced words, effects land on the words, music not louder than voice.
- [ ] No `browser:` errors in the render log.
- [ ] `script.md` written.
