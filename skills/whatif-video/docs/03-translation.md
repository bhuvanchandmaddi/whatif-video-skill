# 03 · Telugu and Hindi narration

The visuals and captions are English for all three videos; only the voice changes. The Telugu and Hindi lines must sound like a young person **talking to a friend**, not like a textbook or a news reader.

## Rules for both languages
1. **Translate the meaning, not the words.** Same beat, same cue, natural phrasing.
2. **Keep everyday English loanwords** people actually say: phone, homework, school, traffic, gift, reel, notification, screen time, exam, result, follow, subscribe, share.
3. **Short sentences** with commas where a speaker would pause. The engine keeps pauses short (max 0.22 s, Telugu 0.32 s).
4. **Questions end with `?`**, exclamations with `!`; this changes the TTS intonation.
5. Keep the second person ("you" → నువ్వు / तुम).

## Telugu (Shruti voice)
- Use spoken forms: అయింది (not అయినది), చేస్తావు, వస్తుంది, ఏంటి, అంతే, రా (to a friend), అమ్మా (to Mom), సార్ (to a teacher).
- **Write numbers as Telugu words** (నూట అరవై తొమ్మిది, తొంభై, పదిహేడు). Digits are read stiffly and in the wrong register.
- Fillers and openers that sound native: ఒక్కసారి ఊహించు…, అంతే!, అరె, హా…, ఇక…
- Example: "You say yes. Snap. 169." → "నువ్వు, హా అయిపోయింది అమ్మా అంటావు. అంతే! నూట అరవై తొమ్మిది."

## Hindi (Swara voice)
- Use Hinglish where natural: "होमवर्क हो गया?", "बस एक और रील", "फ़ोन चेक".
- Digits are fine in Hindi (Swara reads them naturally): "169".
- Natural openers: सोचो…, बस!, और रुको…, अब…
- Example: "You say yes. Snap. 169." → "तुम कहते हो, हाँ. बस! 169."

## Anchors (keep the effect on the right word)
Cues are English words. In other languages the engine maps time proportionally, which can drift by a second. For every important cue (the counter change, the shrink/grow, the reaction shot), add an **anchor**: the English cue word → the word in that language where the effect should land.

```json
"anchors": {
  "te": { "Snap": "అంతే", "169": "నూట" },
  "hi": { "Snap": "बस" }
}
```
- The anchor word must be **one word exactly as the TTS splits it** (no punctuation needed). After `voice`, run `python engine/make_video.py anchors videos/<slug>`: it lists any anchor word that the TTS output does not contain. Pick another word from the printed list.
- Digits that appear in both languages (`169` in Hindi) are matched automatically.
- Anchors must go forward in time in the same order as the English cues.

## CTA
Use `"say": {"en": "{cta}", "te": "{cta}", "hi": "{cta}"}`. The real lines live in `engine/config.json` (`cta_say`) so every video ends the same way.
