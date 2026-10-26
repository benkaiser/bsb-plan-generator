import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import tools from '../scripts/audio_tools.js';
import downloads from '../scripts/download_audio.js';

test('official chapter IDs use the canonical Bible Hub abbreviations', () => {
  assert.equal(downloads.ensureAudioBookId('MRK'), 'Mrk');
  assert.equal(downloads.ensureAudioBookId('SNG'), 'Sng');
  assert.equal(downloads.ensureAudioBookId('JOL'), 'Jol');
  assert.equal(downloads.ensureAudioBookId('NAM'), 'Nam');
  assert.equal(downloads.ensureAudioBookId('1JN'), '1Jn');
});

test('audio pipeline rejects truncated sources and atomically repairs bad outputs', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'bsb-audio-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'source.mp3');
  const truncated = path.join(directory, 'truncated.mp3');
  const target = path.join(directory, 'target.mp3');
  execFileSync('ffmpeg', [
    '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100',
    '-t', '4', '-c:a', 'libmp3lame', '-b:a', '96k', source
  ]);
  const bytes = await readFile(source);
  await writeFile(truncated, bytes.subarray(0, Math.floor(bytes.length / 4)));
  const good = await tools.validateAudio(source);
  assert.ok(good.duration > 3.9);
  await assert.rejects(tools.validateAudio(truncated), /Truncated audio/);
  await writeFile(target, 'keep existing file');
  await assert.rejects(tools.processAudio(truncated, target), /Truncated audio/);
  assert.equal(await readFile(target, 'utf8'), 'keep existing file');
  assert.equal(await tools.processAudio(source, target), true);
  assert.equal(await tools.processAudio(source, target), false);
  await writeFile(target, bytes.subarray(0, Math.floor(bytes.length / 4)));
  assert.equal(await tools.processAudio(source, target), true);
  assert.ok(Math.abs((await tools.validateAudio(target)).duration - good.duration) < 0.15);
  assert.equal((await readdir(directory)).some(file => file.includes('.part.')), false);
});

test('downloads validate decoded audio before replacing an existing file', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'bsb-download-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'source.mp3');
  execFileSync('ffmpeg', [
    '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '4',
    '-c:a', 'libmp3lame', '-b:a', '96k', source
  ]);
  const bytes = await readFile(source);
  const server = createServer((request, response) => {
    if (request.url === '/missing') {
      response.writeHead(404).end();
    } else if (request.url === '/truncated') {
      response.end(bytes.subarray(0, Math.floor(bytes.length / 4)));
    } else if (request.url === '/interrupted') {
      response.writeHead(200, { 'Content-Length': bytes.length });
      response.write(bytes.subarray(0, 1000));
      setImmediate(() => response.destroy());
    } else response.end(bytes);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const destination = path.join(directory, 'download.mp3');
  await writeFile(destination, 'original');
  for (const route of ['/missing', '/truncated', '/interrupted']) {
    await assert.rejects(tools.downloadAudio(origin + route, destination));
    assert.equal(await readFile(destination, 'utf8'), 'original');
    assert.equal((await readdir(directory)).some(file => file.includes('.part.')), false);
  }
  await tools.downloadAudio(origin + '/good', destination);
  assert.deepEqual(await readFile(destination), bytes);
});
