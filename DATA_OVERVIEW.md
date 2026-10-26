# Data Overview

This document provides an overview of the audio data processing and mapping for the BSB EPUB Plan Generator.

## Audio Files

### Locations
- **Raw Audio**: `audio_hays_raw/` - Contains the original high-quality MP3 files downloaded from the source.
- **Processed Audio**: `audio_processed/` - Contains the compressed and optimized MP3 files used by the application.

### Processing Format
The processed audio files in `audio_processed/` are optimized for web delivery and client-side manipulation with the following specifications:
- **Codec**: libmp3lame
- **Bitrate**: 32k (Constant Bitrate)
- **Sample Rate**: 22050 Hz
- **Metadata**: All metadata (ID3 tags, etc.) has been stripped (`-map_metadata -1 -write_xing 0 -id3v2_version 0`).

#### Why Strip Metadata?
Stripping the metadata and headers is critical for the application's ability to **concatenate audio files in memory**. By removing ID3 tags and Xing headers, the resulting MP3 files become "pure" bitstreams. This allows the application to join multiple audio blobs together into a single continuous stream without causing parsing errors or playback glitches that would otherwise occur when a player encounters metadata headers in the middle of a file.

## Naming Scheme and Mapping

The audio files follow a numeric naming scheme that maps directly to the HTML chapter files in the EPUB structure.

### Mapping Logic
The mapping is based on the `bibleData` structure found in `src/bibleData.js`. Each book has a `startFile` number, which corresponds to the first chapter of that book in the EPUB's `OEBPS/Text/` directory.

- **EPUB Chapter File**: `[N].htm` (e.g., `1.htm` for Genesis 1)
- **Audio File**: `[N].mp3` (e.g., `1.mp3` for Genesis 1)

For any given book and chapter:
`Audio Filename = (Book Start File) + (Chapter Number) - 1`

### Example Mappings
| Book | Chapter | EPUB File | Audio File |
| :--- | :--- | :--- | :--- |
| Genesis | 1 | `1.htm` | `1.mp3` |
| Genesis | 50 | `50.htm` | `50.mp3` |
| Exodus | 1 | `51.htm` | `51.mp3` |
| Psalms | 1 | `479.htm` | `479.mp3` |
| Revelation | 22 | `1189.htm` | `1189.mp3` |

## Scripts

- `scripts/download_audio.js`: Downloads raw recordings from Bible Hub's Hays source, `https://openbible.com/audio/hays/`. Filenames use canonical book codes, for example `BSB_41_Mrk_004_H.mp3`. Existing files are decoded and validated before being skipped. Downloads are written to temporary files, validated, then atomically renamed; HTTP, interrupted-transfer and decoding failures fail the command without replacing existing files.
- `scripts/process_audio.sh`: Runs the validated processing pipeline with four workers. Existing outputs are only skipped when they decode correctly and match the source duration within 150 ms. Invalid sources are rejected; replacement outputs are validated before being atomically published.
- `node scripts/audio_tools.js audit`: Fully decodes both raw and processed recordings and checks advertised versus decoded durations and source/output agreement. Exits unsuccessfully if any chapter fails.

These commands require Node.js 18+ and `ffmpeg`/`ffprobe` on `PATH`.

### Truncated recording repair

An audit of all 1,189 chapter pairs found 20 truncated original downloads: Song of Solomon 1-8 (672-679), Joel 1-3 (877-879), Nahum 1-3 (901-903), and Mark 1-6 (958-963). Their MP3 headers still advertised the original full duration, but decoding stopped early. Mark 4, for example, advertised about 350 seconds but only decoded about 68 seconds. The old processing script compressed those fragments and then skipped the existing outputs on every subsequent run.

Those raw files were replaced from the complete Bible Hub Hays recordings and their processed counterparts rebuilt. All 1,189 raw/processed pairs subsequently passed the full decoding audit.

The replacement recordings are not byte-for-byte or timing-identical to the old source: lead-in and internal pauses can differ. Downstream verse/word alignments must be regenerated against the repaired processed files, not stretched from the truncated alignments or corrected using a single chapter-wide offset.
