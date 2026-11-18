# 01 · Style bible

What the reference format does, and why each rule in this skill exists. Measured from LECUDEN-style reels (60-100 s, 720×1280, 6 reels studied frame by frame).

## The look
- **Low-poly, flat-shaded 3D**, bright saturated colours, soft sun shadows, simple everyday sets (bedroom, kitchen, classroom, street, house front, park).
- **One recurring hero** in a signature outfit. Ours: teal hoodie with white drawstrings and a yellow badge, dark joggers, yellow sneakers, black quiff (`HERO` in `engine/runtime/person.js`). Supporting cast are presets (mom, dad, brother, teacher, friend…).
- **Big, expressive faces**: white eyes with black pupils, brows that move, a mouth that opens while talking.

## The overlays (positions are fixed in `style.css`)
| Element | Where | Style |
|---|---|---|
| Title card | top third, on hook + outro | chunky Luckiest Guy, white with thick black outline, key words yellow (`*word*`) or red (`!word!`) |
| Counter pill | under the title | mono font, coloured border: green / red / yellow / gray, label + value + unit (`HEIGHT 169 CM`) |
| Captions | lower middle | 1-3 lowercase words, mono on dark box; keywords coloured (`hl`) |
| Watermark | top-right | `@bhuvi.explains.xx`, semi-transparent |
| CTA card | lower third, last scene | FOLLOW · SUBSCRIBE · SHARE + handle |

## The rhythm
- A new camera angle every **2-4 s**; a new set every **4-8 s**.
- The visible variable (counter, size, age, altitude) changes **exactly on the spoken word**, with a sound effect.
- Narration is fast, second person ("You wake up…"), present tense, short sentences.
- Music: light, quirky, ducked under the voice. SFX on every change.

## The story shape
1. **Flash-forward tease**: the most extreme moment first ("This guy lost 80 cm in one week…"), then the rewind ("…just by lying").
2. **Hook question** with title card: "What if every lie made you 1 cm shorter?"
3. **Normal start** → **small consequences** → **escalation** (montage, big jumps).
4. **Curiosity line** mid-video ("And wait till you see who ends up the tallest").
5. **Twist** that flips the rule onto someone else / society.
6. **Payoff** (often funny or wholesome).
7. **Ending question** that invites comments ("Could you go one day without lying?") + CTA.

## What we deliberately do differently
- Our own hero design, sets and code-generated audio (no copying of characters or assets).
- Three languages from one storyboard, with the native-language narration timed to the same visuals.
