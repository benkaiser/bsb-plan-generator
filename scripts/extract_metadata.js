const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'bsb_unzipped/bsb - final - 7-18-21/OEBPS/Text/0.htm');
const content = fs.readFileSync(filePath, 'utf8');

const bookRegex = /<a href="(\d+)\.htm"[^>]*>([\s\S]*?)<\/a>/g;
let match;
const books = [];

while ((match = bookRegex.exec(content)) !== null) {
    const name = match[2].replace(/&nbsp;/g, ' ').replace(/\u00a0/g, ' ').replace(/<[^>]+>/g, '').trim();
    if (name && !name.includes('Home')) {
        books.push({
            name: name,
            startFile: parseInt(match[1])
        });
    }
}

// Sort books by startFile to ensure they are in order
books.sort((a, b) => a.startFile - b.startFile);

// Revelation starts at 1168. Revelation 22 is 1189.
// The next file after Revelation 22 would be 1190.
books.push({ name: 'END', startFile: 1190 });

const bibleData = [];
for (let i = 0; i < books.length - 1; i++) {
    bibleData.push({
        name: books[i].name,
        startFile: books[i].startFile,
        chapters: books[i + 1].startFile - books[i].startFile
    });
}

process.stdout.write(JSON.stringify(bibleData, null, 2));
