#!/usr/bin/env node
// Phase 0 tooling: send the same Korean rehearsal sample to Whisper / Naver
// Clova Speech / Google Cloud STT and compare filler-word detection.
//
// Usage:
//   node compare-stt.mjs --audio ../../samples/rehearsal-sample.wav
//
// Any API whose credentials are missing from .env is skipped, not failed.

import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, ".env"));

function parseArgs(argv) {
  const args = { audio: null, encoding: null, sampleRate: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--audio") args.audio = argv[++i];
    else if (argv[i] === "--encoding") args.encoding = argv[++i];
    else if (argv[i] === "--sampleRate") args.sampleRate = Number(argv[++i]);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.audio) {
  console.error(
    "Usage: node compare-stt.mjs --audio <path-to-sample> [--encoding LINEAR16] [--sampleRate 16000]"
  );
  process.exit(1);
}
const audioPath = path.resolve(process.cwd(), args.audio);
if (!existsSync(audioPath)) {
  console.error(`Audio file not found: ${audioPath}`);
  process.exit(1);
}

const fillerWords = JSON.parse(
  await readFile(
    path.join(__dirname, "../../web/src/lib/filler-words.json"),
    "utf8"
  )
);

let groundTruth = null;
const groundTruthPath = path.join(__dirname, "ground-truth.json");
if (existsSync(groundTruthPath)) {
  groundTruth = JSON.parse(await readFile(groundTruthPath, "utf8"));
}

function countFillerWords(transcript) {
  const tokens = transcript
    .split(/\s+/)
    .map((t) => t.replace(/^[.,!?~"'()\[\]{}…·]+|[.,!?~"'()\[\]{}…·]+$/g, ""))
    .filter(Boolean);

  const counts = {};
  for (const { word } of fillerWords) counts[word] = 0;
  for (const token of tokens) {
    if (Object.prototype.hasOwnProperty.call(counts, token)) {
      counts[token] += 1;
    }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, total };
}

function detectionRate(detectedTotal) {
  if (!groundTruth) return null;
  const manualTotal = Object.values(groundTruth.manualCounts ?? {}).reduce(
    (a, b) => a + b,
    0
  );
  if (manualTotal === 0) return null;
  return Math.round((detectedTotal / manualTotal) * 1000) / 10; // one decimal
}

// ---------- OpenAI Whisper ----------
async function transcribeWithWhisper(filePath) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { skipped: true, reason: "OPENAI_API_KEY not set" };

  const fileBuffer = await readFile(filePath);
  const form = new FormData();
  form.append(
    "file",
    new Blob([fileBuffer]),
    path.basename(filePath)
  );
  form.append("model", "whisper-1");
  form.append("language", "ko");
  // Bias recognition toward keeping filler words in the output.
  form.append(
    "prompt",
    fillerWords.map((f) => f.word).join(", ") +
      " 등 필러워드를 그대로 살려서 받아써주세요."
  );
  form.append("response_format", "json");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Whisper API error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return { text: data.text };
}

// ---------- Naver Clova Speech Recognition (CSR, short-form) ----------
async function transcribeWithClova(filePath) {
  const id = process.env.NAVER_CLOVA_CLIENT_ID;
  const secret = process.env.NAVER_CLOVA_CLIENT_SECRET;
  if (!id || !secret) {
    return {
      skipped: true,
      reason: "NAVER_CLOVA_CLIENT_ID / NAVER_CLOVA_CLIENT_SECRET not set",
    };
  }

  const fileBuffer = await readFile(filePath);
  const res = await fetch(
    "https://naveropenapi.apigw.ntruss.com/recog/v1/stt?lang=Kor",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-NCP-APIGW-API-KEY-ID": id,
        "X-NCP-APIGW-API-KEY": secret,
      },
      body: fileBuffer,
    }
  );
  if (!res.ok) {
    throw new Error(
      `Clova CSR error ${res.status}: ${await res.text()} ` +
        "(note: the short-form CSR endpoint has a ~60s/10MB limit; trim the sample or switch to the async Clova Speech long-sentence API for longer clips)"
    );
  }
  const data = await res.json();
  return { text: data.text };
}

// ---------- Google Cloud Speech-to-Text (long-running, handles 1-2 min) ----------
async function transcribeWithGoogle(filePath, { encoding, sampleRate }) {
  const apiKey = process.env.GOOGLE_STT_API_KEY;
  if (!apiKey) return { skipped: true, reason: "GOOGLE_STT_API_KEY not set" };

  const ext = path.extname(filePath).toLowerCase();
  const resolvedEncoding =
    encoding ??
    { ".wav": "LINEAR16", ".flac": "FLAC", ".ogg": "OGG_OPUS", ".mp3": "MP3" }[
      ext
    ] ??
    "LINEAR16";
  const resolvedSampleRate = sampleRate ?? 16000;

  const fileBuffer = await readFile(filePath);
  const content = fileBuffer.toString("base64");

  const startRes = await fetch(
    `https://speech.googleapis.com/v1/speech:longrunningrecognize?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: {
          encoding: resolvedEncoding,
          sampleRateHertz: resolvedSampleRate,
          languageCode: "ko-KR",
          enableAutomaticPunctuation: false,
        },
        audio: { content },
      }),
    }
  );
  if (!startRes.ok) {
    throw new Error(
      `Google STT start error ${startRes.status}: ${await startRes.text()}`
    );
  }
  const { name: operationName } = await startRes.json();

  const deadline = Date.now() + 8 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollRes = await fetch(
      `https://speech.googleapis.com/v1/operations/${operationName}?key=${apiKey}`
    );
    if (!pollRes.ok) {
      throw new Error(
        `Google STT poll error ${pollRes.status}: ${await pollRes.text()}`
      );
    }
    const op = await pollRes.json();
    if (op.done) {
      const results = op.response?.results ?? [];
      const text = results
        .map((r) => r.alternatives?.[0]?.transcript ?? "")
        .join(" ")
        .trim();
      return { text };
    }
  }
  throw new Error("Google STT operation timed out after 8 minutes");
}

// ---------- Run all three and report ----------
async function run() {
  const providers = [
    { name: "OpenAI Whisper", fn: () => transcribeWithWhisper(audioPath) },
    { name: "Naver Clova Speech", fn: () => transcribeWithClova(audioPath) },
    {
      name: "Google Cloud STT",
      fn: () =>
        transcribeWithGoogle(audioPath, {
          encoding: args.encoding,
          sampleRate: args.sampleRate,
        }),
    },
  ];

  const rows = [];
  for (const provider of providers) {
    process.stderr.write(`\n=== ${provider.name} ===\n`);
    try {
      const result = await provider.fn();
      if (result.skipped) {
        console.error(`skipped: ${result.reason}`);
        rows.push({ name: provider.name, skipped: true, reason: result.reason });
        continue;
      }
      const { counts, total } = countFillerWords(result.text);
      const rate = detectionRate(total);
      console.error(`transcript: ${result.text}`);
      console.error(`filler counts: ${JSON.stringify(counts)}`);
      console.error(`total: ${total}${rate !== null ? `  detection rate vs manual count: ${rate}%` : ""}`);
      rows.push({ name: provider.name, text: result.text, counts, total, rate });
    } catch (err) {
      console.error(`error: ${err.message}`);
      rows.push({ name: provider.name, error: err.message });
    }
  }

  console.log("\n--- Markdown row(s) for docs/phase0-stt-comparison.md ---\n");
  for (const row of rows) {
    if (row.skipped) {
      console.log(`| ${row.name} | _(skipped: ${row.reason})_ | - | - | |`);
    } else if (row.error) {
      console.log(`| ${row.name} | _(error)_ | - | - | ${row.error} |`);
    } else {
      const preview =
        row.text.length > 60 ? `${row.text.slice(0, 60)}…` : row.text;
      console.log(
        `| ${row.name} | ${preview} | ${row.total} | ${
          row.rate !== null ? `${row.rate}%` : "N/A (ground-truth.json 없음)"
        } | |`
      );
    }
  }
}

run();
