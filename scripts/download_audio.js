const fs = require('fs');
const path = require('path');
const https = require('https');

const bookCodes = [
  'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS',
  'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI',
  '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB',
  'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER',
  'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO',
  'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP',
  'HAG', 'ZEC', 'MAL', 'MAT', 'MRK', 'LUK',
  'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL',
  'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI',
  '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE',
  '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV'
];

const bibleData = [
  { "name": "Genesis", "startFile": 1, "chapters": 50 },
  { "name": "Exodus", "startFile": 51, "chapters": 40 },
  { "name": "Leviticus", "startFile": 91, "chapters": 27 },
  { "name": "Numbers", "startFile": 118, "chapters": 36 },
  { "name": "Deuteronomy", "startFile": 154, "chapters": 34 },
  { "name": "Joshua", "startFile": 188, "chapters": 24 },
  { "name": "Judges", "startFile": 212, "chapters": 21 },
  { "name": "Ruth", "startFile": 233, "chapters": 4 },
  { "name": "1 Samuel", "startFile": 237, "chapters": 31 },
  { "name": "2 Samuel", "startFile": 268, "chapters": 24 },
  { "name": "1 Kings", "startFile": 292, "chapters": 22 },
  { "name": "2 Kings", "startFile": 314, "chapters": 25 },
  { "name": "1 Chronicles", "startFile": 339, "chapters": 29 },
  { "name": "2 Chronicles", "startFile": 368, "chapters": 36 },
  { "name": "Ezra", "startFile": 404, "chapters": 10 },
  { "name": "Nehemiah", "startFile": 414, "chapters": 13 },
  { "name": "Esther", "startFile": 427, "chapters": 10 },
  { "name": "Job", "startFile": 437, "chapters": 42 },
  { "name": "Psalms", "startFile": 479, "chapters": 150 },
  { "name": "Proverbs", "startFile": 629, "chapters": 31 },
  { "name": "Ecclesiastes", "startFile": 660, "chapters": 12 },
  { "name": "Songs", "startFile": 672, "chapters": 8 },
  { "name": "Isaiah", "startFile": 680, "chapters": 66 },
  { "name": "Jeremiah", "startFile": 746, "chapters": 52 },
  { "name": "Lamentations", "startFile": 798, "chapters": 5 },
  { "name": "Ezekiel", "startFile": 803, "chapters": 48 },
  { "name": "Daniel", "startFile": 851, "chapters": 12 },
  { "name": "Hosea", "startFile": 863, "chapters": 14 },
  { "name": "Joel", "startFile": 877, "chapters": 3 },
  { "name": "Amos", "startFile": 880, "chapters": 9 },
  { "name": "Obadiah", "startFile": 889, "chapters": 1 },
  { "name": "Jonah", "startFile": 890, "chapters": 4 },
  { "name": "Micah", "startFile": 894, "chapters": 7 },
  { "name": "Nahum", "startFile": 901, "chapters": 3 },
  { "name": "Habakkuk", "startFile": 904, "chapters": 3 },
  { "name": "Zephaniah", "startFile": 907, "chapters": 3 },
  { "name": "Haggai", "startFile": 910, "chapters": 2 },
  { "name": "Zechariah", "startFile": 912, "chapters": 14 },
  { "name": "Malachi", "startFile": 926, "chapters": 4 },
  { "name": "Matthew", "startFile": 930, "chapters": 28 },
  { "name": "Mark", "startFile": 958, "chapters": 16 },
  { "name": "Luke", "startFile": 974, "chapters": 24 },
  { "name": "John", "startFile": 998, "chapters": 21 },
  { "name": "Acts", "startFile": 1019, "chapters": 28 },
  { "name": "Romans", "startFile": 1047, "chapters": 16 },
  { "name": "1 Corinthians", "startFile": 1063, "chapters": 16 },
  { "name": "2 Corinthians", "startFile": 1079, "chapters": 13 },
  { "name": "Galatians", "startFile": 1092, "chapters": 6 },
  { "name": "Ephesians", "startFile": 1098, "chapters": 6 },
  { "name": "Philippians", "startFile": 1104, "chapters": 4 },
  { "name": "Colossians", "startFile": 1108, "chapters": 4 },
  { "name": "1 Thessalonians", "startFile": 1112, "chapters": 5 },
  { "name": "2 Thessalonians", "startFile": 1117, "chapters": 3 },
  { "name": "1 Timothy", "startFile": 1120, "chapters": 6 },
  { "name": "2 Timothy", "startFile": 1126, "chapters": 4 },
  { "name": "Titus", "startFile": 1130, "chapters": 3 },
  { "name": "Philemon", "startFile": 1133, "chapters": 1 },
  { "name": "Hebrews", "startFile": 1134, "chapters": 13 },
  { "name": "James", "startFile": 1147, "chapters": 5 },
  { "name": "1 Peter", "startFile": 1152, "chapters": 5 },
  { "name": "2 Peter", "startFile": 1157, "chapters": 3 },
  { "name": "1 John", "startFile": 1160, "chapters": 5 },
  { "name": "2 John", "startFile": 1165, "chapters": 1 },
  { "name": "3 John", "startFile": 1166, "chapters": 1 },
  { "name": "Jude", "startFile": 1167, "chapters": 1 },
  { "name": "Revelation", "startFile": 1168, "chapters": 22 }
];

function ensureAudioBookId(bookCode) {
  const manualMappings = {
    'SNG': 'Son',
    'JOL': 'Joe',
    'NAM': 'Nah',
    'MRK': 'Mar',
    'JHN': 'Joh',
    'PHP': 'Phi',
    '1JN': '1Jo',
    '2JN': '2Jo',
    '3JN': '3Jo',
    'JAS': 'Jam'
  };

  if (manualMappings[bookCode]) {
    return manualMappings[bookCode];
  }

  // Convert GEN to Gen, 1SA to 1Sa, PSA to Psa
  if (bookCode.match(/^\d/)) {
    return bookCode.charAt(0) + bookCode.charAt(1).toUpperCase() + bookCode.slice(2).toLowerCase();
  }
  return bookCode.charAt(0).toUpperCase() + bookCode.slice(1).toLowerCase();
}

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function run() {
  const outputDir = path.join(__dirname, '../audio_hays_raw');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const tasks = [];
  for (let i = 0; i < bibleData.length; i++) {
    const book = bibleData[i];
    const code = bookCodes[i];
    const audioBookId = ensureAudioBookId(code);

    for (let chapter = 1; chapter <= book.chapters; chapter++) {
      let chapterStr = chapter.toString().padStart(2, '0');
      if (audioBookId === 'Psa') {
        chapterStr = chapter.toString().padStart(3, '0');
      }
      const url = `https://tim.z73.com/hays/audio/${audioBookId}${chapterStr}.mp3`;
      const dest = path.join(outputDir, `${book.startFile + chapter - 1}.mp3`);
      
      if (fs.existsSync(dest)) {
        continue;
      }

      tasks.push({ url, dest });
    }
  }

  console.log(`Total files to download: ${tasks.length}`);

  const limit = 20;
  for (let i = 0; i < tasks.length; i += limit) {
    const batch = tasks.slice(i, i + limit);
    console.log(`Downloading batch ${i / limit + 1} / ${Math.ceil(tasks.length / limit)}...`);
    await Promise.all(batch.map(task => {
      return downloadFile(task.url, task.dest).catch(err => {
        console.error(`Error downloading ${task.url}: ${err.message}`);
      });
    }));
  }
  console.log('Finished downloading all files.');
}

run();
