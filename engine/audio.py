"""Audio: Edge neural TTS with word timings, procedural music bed and sound effects, numpy mixing.

Everything except the TTS call is generated locally, so there is no third-party audio to license.
"""
import asyncio
import json
import ssl
import subprocess
import wave
from pathlib import Path

import numpy as np

SR = 48000


# ----------------------------------------------------------------------------- ffmpeg helpers
def ffmpeg_bin():
    import shutil
    for c in [shutil.which("ffmpeg")]:
        if c:
            return c
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def decode(path, sr=SR):
    raw = subprocess.run([ffmpeg_bin(), "-loglevel", "error", "-i", str(path), "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def write_wav(path, a, sr=SR, channels=1):
    a = np.clip(a, -1, 1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(channels); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((a * 32767).astype(np.int16).tobytes())


def read_wav(path):
    with wave.open(str(path), "rb") as w:
        a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32767
    return a


# ----------------------------------------------------------------------------- TTS
def _ssl_ctx():
    """certifi + OS trust store, so corporate TLS proxies (custom root CAs) also work."""
    import certifi
    ctx = ssl.create_default_context(cafile=certifi.where())
    ctx.load_default_certs()
    for f in ["/etc/ssl/certs/ca-certificates.crt", "/etc/pki/tls/certs/ca-bundle.crt", "/etc/ssl/cert.pem"]:
        if Path(f).exists():
            try:
                ctx.load_verify_locations(f)
            except Exception:
                pass
    return ctx


def _patch_edge():
    import edge_tts.communicate as c
    import edge_tts.voices as v
    ctx = _ssl_ctx()
    c._SSL_CTX = ctx
    v._SSL_CTX = ctx


async def _tts(text, voice, rate, pitch, out_mp3):
    import edge_tts
    com = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary")
    words, audio = [], bytearray()
    async for ch in com.stream():
        if ch["type"] == "audio":
            audio.extend(ch["data"])
        elif ch["type"] == "WordBoundary":
            words.append([ch["text"], ch["offset"] / 1e7, (ch["offset"] + ch["duration"]) / 1e7])
    Path(out_mp3).write_bytes(bytes(audio))
    return words


def tts(text, voice, rate, pitch, out_mp3, retries=4):
    """Synthesize text -> mp3; returns word boundaries [[word, start, end], ...] in seconds."""
    _patch_edge()
    last = None
    for k in range(retries):
        try:
            return asyncio.run(_tts(text, voice, rate, pitch, out_mp3))
        except Exception as e:  # network hiccups are common; retry with backoff
            last = e
            import time
            time.sleep(1.5 * (k + 1))
    raise RuntimeError(f"Edge TTS failed for voice {voice}: {last}")


def trim(a, thr=0.012, pad=0.04):
    idx = np.where(np.abs(a) > thr)[0]
    if not len(idx):
        return a, 0.0
    s = max(0, idx[0] - int(pad * SR)); e = min(len(a), idx[-1] + int(pad * SR))
    return a[s:e], s / SR


def compress_pauses(a, words, max_gap=0.2, thr=0.01, win=0.01):
    """Shorten internal silences longer than max_gap (Edge pauses ~0.8 s at full stops; shorts need snappy delivery).
    Returns (audio, words) with word times remapped."""
    hop = int(win * SR)
    n = len(a) // hop
    if n < 3:
        return a, words
    rms = np.sqrt(np.mean(a[: n * hop].reshape(n, hop) ** 2, axis=1))
    silent = rms < thr
    cuts = []  # (start_sample, end_sample) to remove
    i = 0
    while i < n:
        if silent[i]:
            j = i
            while j < n and silent[j]:
                j += 1
            gap = (j - i) * win
            if gap > max_gap and i > 0 and j < n:
                keep = int(max_gap * SR)
                s0 = i * hop + keep // 2; s1 = j * hop - keep // 2
                if s1 > s0:
                    cuts.append((s0, s1))
            i = j
        else:
            i += 1
    if not cuts:
        return a, words
    parts, last, fade = [], 0, int(0.008 * SR)
    for s0, s1 in cuts:
        seg = a[last:s0].copy()
        if len(seg) > fade:
            seg[-fade:] *= np.linspace(1, 0, fade)
        parts.append(seg); last = s1
    parts.append(a[last:])
    out = np.concatenate(parts)

    def remap(t):
        smp = t * SR
        removed = sum(min(s1, max(s0, smp)) - s0 for s0, s1 in cuts if smp > s0)
        return (smp - removed) / SR
    return out, [[w, remap(s), remap(e)] for w, s, e in words]


# ----------------------------------------------------------------------------- SFX (procedural)
def _env(n, a=0.005, r=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / max(r, 1e-4))


def _noise(n, seed=1):
    return np.random.default_rng(seed).standard_normal(n).astype(np.float32)


def _lowpass(x, k):
    """Moving average via cumulative sum (O(n) for any window)."""
    k = max(1, int(k))
    if k == 1:
        return x
    if len(x) <= k:
        return np.full(len(x), float(np.mean(x)) if len(x) else 0.0, np.float32)
    c = np.cumsum(np.concatenate([np.zeros(1, np.float64), x.astype(np.float64)]))
    y = (c[k:] - c[:-k]) / k
    pad_l = (k - 1) // 2
    return np.concatenate([np.full(pad_l, y[0]), y, np.full(len(x) - len(y) - pad_l, y[-1])]).astype(np.float32)


def sfx(name):
    n = lambda s: int(s * SR)
    t = lambda s: np.arange(n(s)) / SR
    if name == "whoosh":
        L = 0.45; x = _noise(n(L), 2); env = np.sin(np.pi * t(L) / L) ** 2
        lo = _lowpass(x, 18); hi = x - _lowpass(x, 4)
        mix = (lo * (1 - t(L) / L) + hi * 0.5 * (t(L) / L)) * env
        return 0.55 * mix / (np.abs(mix).max() + 1e-9)
    if name == "pop":
        L = 0.12; f = 600 * np.exp(-t(L) * 25) + 300
        return 0.6 * np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(n(L), 0.002, 0.04)
    if name == "click":
        L = 0.05; return 0.5 * _noise(n(L), 5) * _env(n(L), 0.0005, 0.006)
    if name in ("shrink", "grow"):
        L = 0.55; f0, f1 = (900, 180) if name == "shrink" else (180, 900)
        f = f0 * (f1 / f0) ** (t(L) / L)
        vib = 1 + 0.04 * np.sin(2 * np.pi * 18 * t(L))
        y = np.sin(2 * np.pi * np.cumsum(f * vib) / SR) * _env(n(L), 0.005, 0.35)
        y += 0.3 * np.sin(4 * np.pi * np.cumsum(f * vib) / SR) * _env(n(L), 0.005, 0.2)
        return 0.45 * y
    if name == "boing":
        L = 0.6; f = 220 + 140 * np.sin(2 * np.pi * 9 * t(L)) * np.exp(-t(L) * 4)
        return 0.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(n(L), 0.003, 0.25)
    if name == "ding":
        L = 1.0; y = sum(a * np.sin(2 * np.pi * f * t(L)) for f, a in [(1568, 1), (3136, 0.3), (2350, 0.2)])
        return 0.32 * y * _env(n(L), 0.002, 0.35)
    if name == "cash":
        L = 0.9; bell = sum(np.sin(2 * np.pi * f * t(L)) for f in (2093, 2637, 3136)) * _env(n(L), 0.002, 0.3) / 3
        ch = _noise(n(0.12), 9) * _env(n(0.12), 0.001, 0.03)
        y = 0.45 * bell; y[:len(ch)] += 0.4 * ch
        return y
    if name == "thud":
        L = 0.35; f = 90 * np.exp(-t(L) * 6) + 40
        return 0.8 * np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(n(L), 0.002, 0.12) + 0.15 * _lowpass(_noise(n(L), 3), 30) * _env(n(L), 0.001, 0.05)
    if name == "riser":
        L = 1.2; f = 200 * (8 ** (t(L) / L))
        y = 0.25 * np.sin(2 * np.pi * np.cumsum(f) / SR) * (t(L) / L) ** 2 + 0.2 * (_noise(n(L), 4) - _lowpass(_noise(n(L), 4), 6)) * (t(L) / L) ** 3
        return y
    if name == "buzz":
        L = 0.45; y = np.sign(np.sin(2 * np.pi * 140 * t(L))) * 0.25 * _env(n(L), 0.005, 0.3)
        return _lowpass(y, 6)
    if name == "snap":
        L = 0.08; return 0.7 * _noise(n(L), 7) * _env(n(L), 0.0003, 0.012) + 0.3 * np.sin(2 * np.pi * 1800 * t(L)) * _env(n(L), 0.0005, 0.02)
    if name == "glitch":
        L = 0.4; y = np.zeros(n(L), np.float32); r = np.random.default_rng(11)
        for k in range(8):
            s = int(r.random() * (n(L) - 2000)); e = s + 1500
            y[s:e] += 0.3 * np.sign(np.sin(2 * np.pi * (300 + 1500 * r.random()) * np.arange(e - s) / SR))
        return y
    if name == "age":
        # clock tick-tock then a low, slightly detuned bong
        L = 0.9; y = np.zeros(n(L), np.float32)
        for k, at in enumerate((0.0, 0.14)):
            tk = sfx("tick") * (1.0 if k == 0 else 0.7); a0 = n(at); y[a0:a0 + len(tk)] += tk
        tt = t(L - 0.25); bong = (0.35 * np.sin(2 * np.pi * 110 * tt) + 0.18 * np.sin(2 * np.pi * 221.5 * tt) + 0.08 * np.sin(2 * np.pi * 330 * tt)) * _env(len(tt), 0.004, 0.32)
        y[n(0.25):n(0.25) + len(bong)] += bong[: len(y) - n(0.25)]
        return y
    if name == "rewind":
        # tape-rewind: fast descending warble over a reversed whoosh
        L = 0.7; tt = t(L)
        f = 1400 * (0.25 ** (tt / L)) * (1 + 0.25 * np.sin(2 * np.pi * 22 * tt))
        warble = 0.22 * np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.sin(np.pi * tt / L)
        w = sfx("whoosh"); w = np.pad(w, (0, max(0, n(L) - len(w))))[: n(L)][::-1]
        return _lowpass(warble, 3) + 0.6 * w
    if name == "tick":
        L = 0.03; return 0.4 * np.sin(2 * np.pi * 3000 * t(L)) * _env(n(L), 0.0005, 0.008)
    if name == "gasp":
        L = 0.5; x = _noise(n(L), 13); y = (x - _lowpass(x, 3)) * np.sin(np.pi * t(L) / L) ** 0.6 * 0.25
        return _lowpass(y, 2)
    raise ValueError(f"unknown sfx '{name}'. Available: {', '.join(SFX_NAMES)}")


SFX_NAMES = ["age", "rewind", "whoosh", "pop", "click", "shrink", "grow", "boing", "ding", "cash", "thud", "riser", "buzz", "snap", "glitch", "tick", "gasp"]


# ----------------------------------------------------------------------------- music (procedural, playful)
def music_bed(dur, seed=3, bpm=112):
    """Quirky pluck/marimba loop with soft drums, licence-free. Mono float32 @ SR."""
    N = int((dur + 2) * SR)
    out = np.zeros(N, np.float32)
    beat = 60 / bpm
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)
    prog = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]  # C Am F G
    pattern = [0, 2, 1, 2, 0, 2, 1, 2]  # arpeggio over 8 eighths
    rng = np.random.default_rng(seed)

    def pluck(f, L, a=0.18, decay=7):
        t = np.arange(int(L * SR)) / SR
        e = np.exp(-t * decay) * np.minimum(1, t / 0.003)
        return a * e * (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t * 20))

    def place(sig, at):
        s = int(at * SR); e = min(N, s + len(sig))
        if s < N:
            out[s:e] += sig[: e - s]

    bars = int(dur / (beat * 4)) + 2
    for b in range(bars):
        ch = prog[b % 4]; t0 = b * beat * 4
        for k in range(8):
            m = ch[pattern[k]] + (12 if k in (3, 7) else 0)
            place(pluck(hz(m), 0.5, 0.11), t0 + k * beat / 2)
        place(pluck(hz(ch[0] - 24), beat * 1.6, 0.32, 3.5), t0)
        place(pluck(hz(ch[0] - 24), beat * 1.6, 0.25, 3.5), t0 + beat * 2)
        place(pluck(hz(ch[2] - 24), beat * 0.8, 0.22, 4), t0 + beat * 3.5)
        for k in range(4):  # drums
            tt = np.arange(int(0.25 * SR)) / SR
            if k % 2 == 0:
                place(0.5 * np.exp(-tt * 20) * np.sin(2 * np.pi * (48 + 70 * np.exp(-tt * 35)) * tt), t0 + k * beat)
            else:
                nz = rng.standard_normal(len(tt)).astype(np.float32)
                place(0.16 * np.exp(-tt * 28) * (nz - _lowpass(nz, 3)), t0 + k * beat)
            for h in (0, 0.5):
                L = int(0.04 * SR); nz = rng.standard_normal(L).astype(np.float32)
                place(0.05 * np.exp(-np.arange(L) / SR * 90) * (nz - _lowpass(nz, 2)), t0 + (k + h) * beat)
    out = out[: int(dur * SR)]
    fade = int(1.2 * SR); out[-fade:] *= np.linspace(1, 0, fade)
    return out / (np.abs(out).max() + 1e-9)


def mix(voice, sfx_events, dur, music=True, music_gain=0.13, sfx_gain=0.7):
    """voice: float32 array; sfx_events: [(t, name)]. Ducks music under speech."""
    N = int(dur * SR)
    v = np.zeros(N, np.float32); v[: min(N, len(voice))] = voice[:N]
    s = np.zeros(N, np.float32)
    for t, name in sfx_events:
        x = sfx(name).astype(np.float32); a = int(t * SR); e = min(N, a + len(x))
        if 0 <= a < N:
            s[a:e] += x[: e - a]
    out = v + sfx_gain * s
    if music:
        m = music_bed(dur)[:N]
        env = np.sqrt(_lowpass(v ** 2, int(0.25 * SR)))
        duck = 1 - 0.55 * np.clip(env / (env.max() + 1e-9) * 3, 0, 1)
        out += music_gain * m * duck
    return out


def loudnorm(in_wav, out_wav):
    subprocess.run([ffmpeg_bin(), "-y", "-loglevel", "error", "-i", str(in_wav), "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", str(SR), str(out_wav)], check=True)
