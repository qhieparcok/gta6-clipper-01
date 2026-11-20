# GTA 6 Clipper — make.fun bounty entry (gta6-clipper-01)

A vertical Short cut from Rockstar's **Grand Theft Auto VI Trailer 2**,
built for the make.fun bounty **"Clip GTA 6 for the most YouTube views"**
($500 pot, deadline 23 Nov 2026). The clip hooks with the trailer's most
famous frame — Lucia in golden light — then tells the Lucia & Jason story
(prison pickup, robbery, dock sunset, diner dance, rooftop, nightclub) and
pitches make.fun on screen: you can make money on make.fun by making cool
clips with AI.

- **Video:** `VIDEO.json` names the public YouTube Short.
- **Play code:** `makefun-sailboat-galaxy-carpet`
- **Source footage:** official Rockstar Games "Grand Theft Auto VI Trailer 2"
  (YouTube `VQRLujxTm3c`, 6 May 2026, 191M+ views). The trailer itself is
  NOT in this repo — fetch it yourself (see below). All footage is Rockstar's;
  this cut is a transformative clip made for the bounty, as the brief asks.

## The cut (33.5 s, 1080x1920, 30 fps)

| Clip time | Trailer time | Shot |
|---|---|---|
| 0.0–2.3 | 1:11–1:13 | Golden bed, "ROCKSTAR GAMES PRESENTS" — cold-open hook |
| 2.3–10.8 | 1:01–1:09 | Prison pickup / reunion |
| 10.8–14.2 | 1:14–1:18 | Red-lit robbery |
| 14.2–19.0 | 1:20–1:24 | Dock sunset |
| 19.0–21.5 | 1:30–1:33 | Diner dance |
| 21.5–26.3 | 1:35–1:39 | Rooftop, gold dress, hand-hold |
| 26.3–30.5 | 1:39–1:44 | Nightclub |
| 30.5–33.5 | — | Black end card: make.fun pitch + play code |

Burned-in captions: "WAITED 13 YEARS FOR THIS." → "LUCIA IS FREE." →
"AND SO IT BEGINS." → "VICE CITY IS BACK. / MAY 26, 2026" →
"MAKE MONEY ON MAKE.FUN / MAKING CLIPS WITH AI". Original trailer audio is
kept (fade in 0.2 s, fade out over the last 1 s). No voiceover — on-screen
text alone satisfies the brief.

## How to run it

Requirements: **Node 22+** and **ffmpeg + ffprobe** on your PATH
(tested with ffmpeg 8.1.2, Node 24).

```sh
# 1. Get the source trailer (official Rockstar upload, 1080p):
yt-dlp -f "137+140/bestvideo[height<=1080]+bestaudio/best[height<=1080]" \
  --merge-output-format mp4 -o "source-trailer2.mp4" \
  "https://www.youtube.com/watch?v=VQRLujxTm3c"

# 2. Build the clip:
node main.ts source-trailer2.mp4 clip-v1.mp4
```

`main.ts` uses only the Node standard library and shells out to ffmpeg.
It cuts the seven moments above, reframes each to vertical 9:16 with a
per-shot crop (see `SEGMENTS` in `main.ts`), appends the end card, burns in
the captions, and writes a faststart H.264 + AAC mp4.

## Harness mode vs full build

`main.ts` always does Step 0 first, before anything else: it copies
`VIDEO.json` from `$MAKEFUN_BOT_DIR` (default `/bot`, falling back to the
copy next to the script if that directory has no `VIDEO.json`) to
`$MAKEFUN_OUTPUT_DIR/VIDEO.json` (default `/output`, created if needed),
byte-exact, using only the Node standard library. `VIDEO.json` carries
the entry link under the `url` key, per the harness contract. Step 0
needs no ffmpeg and no network, and a failed copy exits non-zero — the
gate needs this file.

- **Harness mode** (no source trailer present, e.g. the house's sandbox):
  after Step 0 the script logs that the clip build is skipped and exits 0.
  It never fails for a missing source trailer. Two runs write the same
  bytes to `$MAKEFUN_OUTPUT_DIR/VIDEO.json`, as the resolution criteria
  require. (The harness wall budget is 60 s; only Step 0 runs inside it.)
- **Full build mode** (source trailer present): after Step 0 the script
  builds `clip-v1.mp4` exactly as above. The Step 0 copy is harmless here
  — it just also leaves `$MAKEFUN_OUTPUT_DIR/VIDEO.json` in place.

## Files

- `main.ts` — the builder (edit the `SEGMENTS` / `CAPTIONS` tables to re-cut)
- `VIDEO.json` — the public YouTube address of the submitted video
- `clip-v1.mp4` — the rendered Short (built by `node main.ts`)
- `transcripts/TRANSCRIPT.md` — the agent session log: moment choice, creative
  decisions, exact commands, verification (submitted with the entry)

## License

MIT — see `LICENSE`.
