# 04 · Storyboard reference

`videos/<slug>/storyboard.json`. The validator (`make_video.py validate`) checks names against `engine/catalog.json` and prints the allowed values in every error.

## Top level
```json
{
  "slug": "lie-shrinks-you",
  "title": "What if every lie you told made you 1 cm shorter?",
  "counter": { "label": "HEIGHT", "fmt": "{v} CM" },
  "scenes": [ ... ]
}
```
`counter.fmt` wraps the value (`{v} YRS`, `₹{v}`, `{v} M`). Omit `counter` if the idea has no number.

## Scene fields
| Field | Type | Meaning |
|---|---|---|
| `id` | string | unique, short (`tease1`, `wake`, `twist`) |
| `say` | `{en, te, hi}` | narration per language; `"{cta}"` for the closing line |
| `anchors` | `{te:{enWord: teWord}, hi:{…}}` | lock cues to native words (docs/03) |
| `set` | string | one of the sets below |
| `setOpts` | object | set options: `night: true` (bedroom), `board: "TEXT\nLINE2"` (classroom), `brokenTV: true` (living), `car: "#hex"` (house_front), `color` (studio) |
| `cam` | camera | the first shot of the scene |
| `shots` | `[{at, cam}]` | camera cuts inside the scene (actors keep animating) |
| `title` | string | title card; `*yellow*`, `!red!`, `\n` line breaks. Use on `hook`, `outro`, `cta` |
| `titleTop` | px | move the title (default 230) |
| `actors` | list | people in the scene (below) |
| `crowds` | list | background people (below) |
| `props` | list | objects (below) |
| `counter` | `[[at, value, color, {opts}]]` | counter events; `value: null` hides it; colors `green` `red` `yellow` `gray`; opts `{"roll": 0.6}` animates the number, `{"label": "BROTHER"}` overrides the label |
| `hl` | `{word: color}` | caption highlight: `y` yellow, `r` red, `g` green (English word, case-insensitive) |
| `sfx` | `[[at, name]]` | sound effects (list below) |
| `flash` | `[at, …]` | white flash |
| `shake` | `[[at, amp, dur]]` | camera shake (amp 0.03-0.08) |
| `cta` / `noCaptions` / `min` | bool / bool / s | for the closing scene: `true`, `true`, `3.2` |

### Cue values (`at`)
`0` / `"start"` · `"end"` · a fraction `0.4` of the scene · an **English word** from `say.en` (`"Snap"`, `"169"`) · `"word#2"` for the second occurrence.

## Actors
```json
{ "id": "hero", "at": "bed", "face": "mom", "scale": 0.53,
  "do":   [[0, "sit"], ["Snap", "shocked"]],
  "expr": [[0, "smirk"], ["Snap", "shocked"]],
  "move": [[0, "Did", [1.4, 0.2]], ["laughed", "end", [0, 0, 1.0], "none"]],
  "grow": [["Snap", 0.97], ["truth", 1.9, 0.6]],
  "turn": [["Everyone", "cam"]],
  "talk": [["Did", "end"]],
  "show": "20", "hide": "40",
  "look": "mom" }
```
| Field | Meaning |
|---|---|
| `id` | `hero` uses the hero design; a preset name (`mom`) uses that preset; any other id needs `look` |
| `look` | preset name or an override object, e.g. `{"hair":"#ececec","beard":"#ececec","glasses":true}` for an old hero (merged onto the hero) |
| `at` | spot name, `[x, z]` or `{"spot":"center","dx":0.5,"dz":-0.1}` |
| `y` | lift above the floor (floating, standing on a desk) |
| `face` | `"cam"`, another actor id, degrees (0 = +z towards the default camera), or `[x, z]` |
| `scale` | 1 = 178 cm adult. Shrinking: 0.53 ≈ 90 cm |
| `do` | `[[at, action]]` pose timeline (cross-faded) |
| `expr` | `[[at, expression]]`: neutral happy smirk shocked scared sad angry sleep laugh |
| `move` | `[[at0, at1, to, gait, ease]]`; `to` = spot / `[x,z]` / `[x,z,y]`; gait = an action (`walk` `run` `phoneWalk` `hunchWalk`) or `"none"` to keep `do` poses (floating); ease `"in"` for falling |
| `grow` | `[[at, scale, dur]]` animated scale changes with squash |
| `turn` | `[[at, face]]` |
| `talk` | `[[at0, at1]]` mouth flaps |
| `show` / `hide` | appear / disappear on a cue (swap a young hero for an old one at the same spot) |

**Actions**: idle walk run talk explain wave cheer shocked scared facepalm think point pointUp thumbsup shrug sad angry lookUp lookDown sit sitTalk sitLaugh sitPhone lie phone phoneWalk jump push carry crouch dance sleep typing float laugh floatLaugh hunch hunchWalk fall.
Sitting actions need a spot with a chair (`bed`, `table`, `seat*`, `sofa`, `boss`, `desk`, `bench`, office `left`/`right`).

**Presets**: hero mom dad brother sister teacher boss friend girl oldman cop doctor.

## Crowds
```json
{ "n": 8, "area": [3.9, -12, 4.9, 6], "action": "walk", "dir": 0, "scale": 0.5, "scaleVar": 0.2, "seed": "t1" }
```
`dir` 0 = towards camera, 180 = away, `"random"`; `faceCam: true` for idle crowds; `look: "hero"` for clones.

## Props
| type | options |
|---|---|
| `thought` | `over: actorId`, `text` (`\n` for lines). A 2D bubble that follows the head; one per moment, use `vanish` |
| `phone` | `hand: actorId`, `text` on screen |
| `bigPhone` | `at`, `y`, `text`, `billboard: true` |
| `backpack` `gift` `ball` `box` `cake` `trophy` `coin` `money` `car` `tree` | `at`, `y`, `scale`, `ry`, `color` |
| `moneyRain` `cloud` | `at`, `y`, `scale`, `seed` |
| `sign` `label` | `text`, `w`, `h`, `bg`, `fg`, `size` |
| `arrow` | bouncing pointer |
Common: `appear`, `vanish` (cues), `grow: [[at, scale, dur]]`, `spin` (rad/s), `hand` + `side: "l"`.

## Sets and spots
| Set | Spots |
|---|---|
| bedroom | center bed bedLie bedside door desk window front left right |
| kitchen | center table tableFront fridge stove door front left right |
| living | center sofa tv door front left right |
| classroom | board teacher door center seat seatFront seatBack front aisle |
| office | boss bossDesk front center left right door desktop |
| street | center sidewalk sidewalkFar across road front left right |
| house_front | door porch path lawn lawnR gate center front sidewalk |
| park | center path bench goal front left right |
| studio | center left right front |

Street: sidewalk at x ≈ 5.5, road at x ∈ [-4, 4], buildings beyond |x| > 8. Street and park are open, so use `y` up to 30 for sky scenes.

## Cameras
```json
{ "type": "medium", "target": "hero", "angle": 20, "move": "push", "fit": 1.4 }
```
| type | framing |
|---|---|
| `close` | face |
| `medium` | head + chest |
| `full` | whole body (default for staging) |
| `wide` | set overview (`dist`, `height`) |
| `low` | from the ground, looking up (heroic / giant) |
| `high` | from above (tiny / trapped) |
| `top` | overhead |
| `hands` | hands / phone |
| `ots` | over the shoulder of `target` looking at `other` (`side` ±1) |
| `pov` | from `target`'s eyes towards `other` |
| `custom` | `pos`, `look`, optional `pos2`/`look2` to move |

- `angle` is **relative to where the target faces**: 0 = in front, 90 = side, 180 = behind.
- `fit` > 1 frames a small character as if bigger (use about 1/scale for tiny heroes).
- `move`: `static` `push` `pull` `crash` `orbitL` `orbitR` `rise` `drop`.
- `fov` (default 56), `dy`, `lx`/`ly`/`lz` nudges, `handheld: 0` to stop drift.

## SFX
age rewind whoosh pop click shrink grow boing ding cash thud riser buzz snap glitch tick gasp.
