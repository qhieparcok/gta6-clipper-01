/**
 * gta6-clipper-01 — build the entry clip (v1) for the make.fun bounty
 * "Clip GTA 6 for the most YouTube views" (slug: gta6-clipper-01).
 *
 * What it does:
 *   1. Cuts the chosen moments out of the official Rockstar "Grand Theft Auto
 *      VI Trailer 2" (source file, 1080p), reframes each shot to vertical
 *      9:16 (1080x1920) with a per-shot crop, and concatenates them into one
 *      arc: golden bed cold-open -> prison pickup -> robbery -> dock sunset
 *      -> diner dance -> rooftop -> nightclub.
 *   2. Appends a 3 s black end card carrying the make.fun pitch + play code.
 *   3. Burns the hook / story / pitch captions into the picture and keeps the
 *      trailer's own audio (fade in 0.2 s, fade out over the last 1 s).
 *
 * Caption text is passed to ffmpeg via text files (drawtext textfile=...),
 * never inline, because ':' and ',' inside inline text break ffmpeg's
 * filter-graph parser.
 *
 * Usage:
 *   node main.ts [source-trailer.mp4] [output.mp4]
 *   Defaults: ./source-trailer2.mp4  ->  ./clip-v1.mp4
 *
 * Requirements: ffmpeg + ffprobe on PATH (tested with ffmpeg 8.1.2).
 * Node 22+ standard library only — no dependencies, no network.
 * The source trailer is NOT included in this repo (Rockstar copyright);
 * fetch it yourself, e.g. with yt-dlp from the official Rockstar Games
 * YouTube upload "Grand Theft Auto VI Trailer 2" (video VQRLujxTm3c).
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Edit decision list (all times in seconds, trailer time)
// ---------------------------------------------------------------------------

interface Segment {
  /** start in the source trailer */
  start: number;
  /** end in the source trailer */
  end: number;
  /** left edge of the 608x1080 vertical crop inside the 1920-wide frame */
  cropX: number;
  /** human-readable label, for the log */
  label: string;
}

const SEGMENTS: Segment[] = [
  { start: 71.2, end: 73.5, cropX: 656, label: "golden bed — cold-open hook" },
  { start: 61.0, end: 69.5, cropX: 640, label: "prison pickup / reunion" },
  { start: 74.8, end: 78.2, cropX: 500, label: "red-lit robbery" },
  { start: 80.0, end: 84.8, cropX: 656, label: "dock sunset" },
  { start: 90.5, end: 93.0, cropX: 656, label: "diner dance" },
  { start: 95.0, end: 99.8, cropX: 656, label: "rooftop, gold dress, hand-hold" },
  { start: 99.8, end: 104.0, cropX: 656, label: "nightclub" },
];

interface Caption {
  /** start in the finished clip */
  start: number;
  /** end in the finished clip */
  end: number;
  /** template literal; a real line break in the string = a second line */
  text: string;
  fontSize: number;
  /** vertical position, fraction of frame height */
  yFrac: number;
}

const CAPTIONS: Caption[] = [
  { start: 0.0, end: 2.3, text: `WAITED 13 YEARS
FOR THIS.`, fontSize: 76, yFrac: 0.3 },
  { start: 2.3, end: 6.3, text: "LUCIA IS FREE.", fontSize: 78, yFrac: 0.3 },
  { start: 10.8, end: 14.2, text: "AND SO IT BEGINS.", fontSize: 78, yFrac: 0.3 },
  { start: 21.5, end: 26.3, text: `VICE CITY IS BACK.
MAY 26, 2026`, fontSize: 72, yFrac: 0.28 },
  { start: 26.3, end: 30.5, text: `MAKE MONEY ON MAKE.FUN
MAKING CLIPS WITH AI`, fontSize: 64, yFrac: 0.28 },
];

const PLAY_CODE = "makefun-sailboat-galaxy-carpet";
const END_CARD_SECONDS = 3;
const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const OUT_W = 1080;
const OUT_H = 1920;
const CROP_W = 608;
const CROP_H = 1080;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function run(cmd: string, args: string[]): void {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { stdio: "inherit" });
}

/** Write caption text to a file and return a drawtext filter using it. */
function drawtext(
  work: string,
  name: string,
  text: string,
  fontSize: number,
  yFrac: number,
  opts: string,
): string {
  const file = join(work, `${name}.txt`);
  writeFileSync(file, text);
  return (
    `drawtext=fontfile=${FONT}:textfile='${file}'` +
    `:fontsize=${fontSize}:fontcolor=white` +
    `:box=1:boxcolor=black@0.6:boxborderw=16` +
    `:x=(w-text_w)/2:y=h*${yFrac}` +
    opts
  );
}

/** Same, but without the black box (for the end card). */
function drawtextPlain(
  work: string,
  name: string,
  text: string,
  fontSize: number,
  yFrac: number,
  fontcolor: string,
): string {
  const file = join(work, `${name}.txt`);
  writeFileSync(file, text);
  return (
    `drawtext=fontfile=${FONT}:textfile='${file}'` +
    `:fontsize=${fontSize}:fontcolor=${fontcolor}` +
    `:x=(w-text_w)/2:y=h*${yFrac}`
  );
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main(): void {
  const source = resolve(process.argv[2] ?? "source-trailer2.mp4");
  const output = resolve(process.argv[3] ?? "clip-v1.mp4");
  if (!existsSync(source)) {
    throw new Error(`source trailer not found: ${source}`);
  }

  // 0. Sanity: source must cover the latest segment end.
  const probe = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration",
     "-of", "csv=p=0", source],
    { encoding: "utf8" },
  ).trim();
  const sourceDuration = parseFloat(probe);
  const lastEnd = Math.max(...SEGMENTS.map((s) => s.end));
  if (!(sourceDuration > lastEnd)) {
    throw new Error(
      `source is ${sourceDuration}s, shorter than last segment end ${lastEnd}s`,
    );
  }
  console.log(`source: ${source} (${sourceDuration.toFixed(1)}s)`);

  const work = mkdtempSync(join(tmpdir(), "gta6-clipper-"));
  try {
    // 1. Cut + reframe every segment (identical encode settings so the
    //    concat demuxer can join them with -c copy).
    const segmentFiles: string[] = [];
    SEGMENTS.forEach((seg, i) => {
      const out = join(work, `seg${i}.mp4`);
      run("ffmpeg", [
        "-v", "error", "-y",
        "-ss", String(seg.start), "-to", String(seg.end),
        "-i", source,
        "-vf",
        `crop=${CROP_W}:${CROP_H}:${seg.cropX}:0,` +
          `scale=${OUT_W}:${OUT_H}:flags=lanczos,setsar=1`,
        "-r", "30",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
        out,
      ]);
      segmentFiles.push(out);
      console.log(`  segment ${i}: ${seg.label} (${(seg.end - seg.start).toFixed(1)}s)`);
    });

    // 2. Black end card (3 s) with the make.fun pitch + play code.
    const card = join(work, "card.mp4");
    const cardDraw = [
      drawtextPlain(work, "card1", "MAKE MONEY MAKING", 84, 0.32, "white"),
      drawtextPlain(work, "card2", "CLIPS WITH AI", 84, 0.4, "white"),
      drawtextPlain(work, "card3", "make.fun", 110, 0.54, "0xFF7AD9"),
      drawtextPlain(work, "card4", `Play code: ${PLAY_CODE}`, 40, 0.68, "white"),
    ].join(",");
    run("ffmpeg", [
      "-v", "error", "-y",
      "-f", "lavfi", "-i",
      `color=c=black:s=${OUT_W}x${OUT_H}:r=30:d=${END_CARD_SECONDS}`,
      "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
      "-t", String(END_CARD_SECONDS),
      "-vf", cardDraw,
      "-r", "30",
      "-c:v", "libx264", "-preset", "medium", "-crf", "18",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
      "-shortest", card,
    ]);

    // 3. Concatenate segments + end card (stream copy: same codecs).
    const listFile = join(work, "concat.txt");
    const footageDuration = SEGMENTS.reduce((a, s) => a + (s.end - s.start), 0);
    writeFileSync(
      listFile,
      [...segmentFiles, card]
        .map((f) => `file '${f.replace(/'/g, "'\\''")}'`)
        .join("\n") + "\n",
    );
    const joined = join(work, "joined.mp4");
    run("ffmpeg", [
      "-v", "error", "-y",
      "-f", "concat", "-safe", "0", "-i", listFile,
      "-c", "copy", joined,
    ]);

    // 4. Burn captions + audio fades, final encode.
    const captionFilter = CAPTIONS.map((c, i) =>
      drawtext(
        work,
        `cap${i}`,
        c.text,
        c.fontSize,
        c.yFrac,
        `:enable='between(t,${c.start},${c.end})'`,
      ),
    ).join(",");
    const fadeOutStart = (footageDuration - 1.0).toFixed(1);
    run("ffmpeg", [
      "-v", "error", "-y",
      "-i", joined,
      "-vf", captionFilter,
      "-af", `afade=t=in:st=0:d=0.2,afade=t=out:st=${fadeOutStart}:d=1.0`,
      "-c:v", "libx264", "-preset", "medium", "-crf", "18",
      "-pix_fmt", "yuv420p", "-r", "30",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      output,
    ]);

    const total = footageDuration + END_CARD_SECONDS;
    console.log(`\ndone: ${output}`);
    console.log(`  footage ${footageDuration.toFixed(1)}s + end card ${END_CARD_SECONDS}s = ${total.toFixed(1)}s`);
    console.log(`  ${OUT_W}x${OUT_H} vertical, H.264 + AAC, captions burned in`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main();
