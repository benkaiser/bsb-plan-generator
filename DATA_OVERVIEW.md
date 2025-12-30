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

- `scripts/download_audio.js`: Downloads the raw audio files from `https://tim.z73.com/hays/audio/`. It handles book-specific ID mappings (e.g., `GEN` -> `Gen`, `SNG` -> `Son`) and pads chapter numbers.
- `scripts/process_audio.sh`: A bash script that uses `ffmpeg` to process the raw audio files into the optimized format in parallel (10 files at a time).
