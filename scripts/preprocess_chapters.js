const fs = require('fs');
const path = require('path');

const textDir = path.join(__dirname, '../bsb_unzipped/bsb - final - 7-18-21/OEBPS/Text');

async function preprocess() {
    const files = fs.readdirSync(textDir).filter(f => f.endsWith('.htm'));
    console.log(`Found ${files.length} files to process...`);

    let count = 0;
    for (const file of files) {
        count++;
        const filePath = path.join(textDir, file);
        const content = fs.readFileSync(filePath, 'utf8');

        // Use a robust regex-based approach to avoid dependency issues
        let newContent = content
            .replace(/<div id="topheading"[^>]*>[\s\S]*?<\/div>/g, '')
            .replace(/<div class="bsbheading"[^>]*>[\s\S]*?<\/div>/g, '')
            .replace(/<div class="calibre8"><p class="cross">[\s\S]*?<\/p><\/div>/g, '')
            .replace(/<div class="nav"[^>]*>[\s\S]*?<\/div>/g, '')
            .replace(/<h1>[\s\S]*?<\/h1>/g, '');

        // Also handle the case where the div might be nested or have different classes
        newContent = newContent.replace(/<div[^>]*id="topheading"[^>]*>[\s\S]*?<\/div>/g, '');
        newContent = newContent.replace(/<div[^>]*class="bsbheading"[^>]*>[\s\S]*?<\/div>/g, '');
        newContent = newContent.replace(/<div[^>]*class="calibre8"><p class="cross">[\s\S]*?<\/p><\/div>/g, '');

        if (newContent !== content) {
            fs.writeFileSync(filePath, newContent);
            if (count % 100 === 0) console.log(`Processed ${count} files...`);
        }
    }
    console.log('Preprocessing complete.');
}

preprocess().catch(err => {
    console.error('Error during preprocessing:', err);
    process.exit(1);
});
