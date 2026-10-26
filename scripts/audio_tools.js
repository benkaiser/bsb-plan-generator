const { execFile } = require('node:child_process');
const { access, mkdir, readdir, rename, rm } = require('node:fs/promises');
const { createWriteStream } = require('node:fs');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { promisify } = require('node:util');

const exec = promisify(execFile);

async function inspectAudio(file) {
  const { stdout } = await exec('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', file
  ]);
  const advertised = Number(JSON.parse(stdout).format.duration);
  const decoded = await exec('ffmpeg', [
    '-v', 'error', '-xerror', '-i', file, '-progress', 'pipe:1', '-nostats', '-f', 'null', '-'
  ]);
  const times = [...decoded.stdout.matchAll(/^out_time_us=(\d+)$/gm)];
  const duration = Number(times.at(-1)?.[1]) / 1e6;
  if (!Number.isFinite(advertised) || !Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Invalid audio duration: ${file}`);
  }
  return { advertised, duration };
}

function assertComplete(info, file) {
  if (Math.abs(info.advertised - info.duration) > 1) {
    throw new Error(`Truncated audio: ${file} advertises ${info.advertised.toFixed(2)}s but decodes ${info.duration.toFixed(2)}s`);
  }
}

async function validateAudio(file) {
  const info = await inspectAudio(file);
  assertComplete(info, file);
  return info;
}

async function downloadAudio(url, destination) {
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${randomUUID()}.part.mp3`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Failed to download ${url}: ${response.status}`);
    }
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
    await validateAudio(temporary);
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function processAudio(source, destination) {
  const raw = await validateAudio(source);
  try {
    await access(destination);
    const existing = await validateAudio(destination);
    if (Math.abs(existing.duration - raw.duration) <= 0.15) return false;
    console.log(`Rebuilding duration mismatch: ${destination}`);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error(`Rebuilding invalid audio: ${destination}: ${error.message}`);
  }
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${randomUUID()}.part.mp3`;
  try {
    await exec('ffmpeg', [
      '-v', 'error', '-xerror', '-y', '-i', source, '-c:a', 'libmp3lame',
      '-b:a', '32k', '-ar', '22050', '-map_metadata', '-1', '-write_xing', '0',
      '-id3v2_version', '0', '-flush_packets', '1', temporary
    ]);
    const processed = await validateAudio(temporary);
    if (Math.abs(processed.duration - raw.duration) > 0.15) {
      throw new Error(`Processed duration does not match source: ${source}`);
    }
    await rename(temporary, destination);
    return true;
  } finally {
    await rm(temporary, { force: true });
  }
}

async function run(mode, root = path.resolve(__dirname, '..')) {
  if (!['audit', 'process'].includes(mode)) throw new Error('Usage: node scripts/audio_tools.js audit|process');
  const files = (await readdir(path.join(root, 'audio_hays_raw')))
    .filter(file => /^\d+\.mp3$/.test(file)).sort((a, b) => parseInt(a) - parseInt(b));
  let next = 0;
  let changed = 0;
  const failures = [];
  async function worker() {
    while (next < files.length) {
      const file = files[next++];
      const source = path.join(root, 'audio_hays_raw', file);
      const destination = path.join(root, 'audio_processed', file);
      try {
        if (mode === 'process') {
          if (await processAudio(source, destination)) {
            changed++;
            console.log(`Rebuilt ${file}`);
          }
        } else {
          const raw = await validateAudio(source);
          const processed = await validateAudio(destination);
          if (Math.abs(raw.duration - processed.duration) > 0.15) {
            throw new Error(`Processed/source duration mismatch: ${file}`);
          }
        }
      } catch (error) {
        failures.push({ file, error: error.message });
        console.error(error.message);
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  console.log(`Checked ${files.length} chapters; rebuilt ${changed}; failed ${failures.length}.`);
  if (failures.length) throw new Error(`${failures.length} chapters failed audio validation`);
}

module.exports = { inspectAudio, assertComplete, validateAudio, downloadAudio, processAudio };
if (require.main === module) run(process.argv[2]).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
