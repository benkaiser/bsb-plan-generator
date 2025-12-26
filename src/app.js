import { h, render } from 'preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import htm from 'htm';
import JSZip from 'jszip';
import { bibleData as BIBLE_BOOKS } from './bibleData.js';

const html = htm.bind(h);

const App = () => {
    const [selectionMode, setSelectionMode] = useState('all');
    const [selectedBooks, setSelectedBooks] = useState(BIBLE_BOOKS.map(b => b.name));
    const [otChaptersPerDay, setOtChaptersPerDay] = useState(3);
    const [ntChaptersPerDay, setNtChaptersPerDay] = useState(1);
    const [psalmsPerDay, setPsalmsPerDay] = useState(0);
    const [proverbsPerDay, setProverbsPerDay] = useState(0);
    const [planOrder, setPlanOrder] = useState('mixed');
    const [padWithRepeats, setPadWithRepeats] = useState(false);
    const [useDates, setUseDates] = useState(true);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [readingDays, setReadingDays] = useState([1, 2, 3, 4, 5, 6, 0]);
    const [status, setStatus] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const toggleBook = (bookName) => {
        setSelectedBooks(prev =>
            prev.includes(bookName)
                ? prev.filter(b => b !== bookName)
                : [...prev, bookName]
        );
    };

    const setPreset = (preset) => {
        setSelectionMode('custom');
        if (preset === 'gospels') {
            setSelectedBooks(['Matthew', 'Mark', 'Luke', 'John']);
        } else if (preset === 'pentateuch') {
            setSelectedBooks(['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy']);
        } else if (preset === 'paul') {
            setSelectedBooks(['Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon']);
        } else if (preset === 'wisdom') {
            setSelectedBooks(['Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon']);
        }
    };

    const toggleDay = (day) => {
        setReadingDays(prev =>
            prev.includes(day)
                ? prev.filter(d => d !== day)
                : [...prev, day].sort()
        );
    };

    const plan = useMemo(() => {
        const booksToInclude = selectionMode === 'all' ? BIBLE_BOOKS : BIBLE_BOOKS.filter(b => selectedBooks.includes(b.name));
        if (booksToInclude.length === 0) return [];

        const otBooks = booksToInclude.filter(b => BIBLE_BOOKS.indexOf(b) < 39);
        const ntBooks = booksToInclude.filter(b => BIBLE_BOOKS.indexOf(b) >= 39);

        const otChapters = [];
        const psalmChapters = [];
        const proverbChapters = [];

        otBooks.forEach(book => {
            for (let i = 1; i <= book.chapters; i++) {
                const chapterObj = { book: book.name, chapter: i, file: book.startFile + i - 1 };
                if (book.name === 'Psalms' && psalmsPerDay > 0) {
                    psalmChapters.push(chapterObj);
                } else if (book.name === 'Proverbs' && proverbsPerDay > 0) {
                    proverbChapters.push(chapterObj);
                } else {
                    otChapters.push(chapterObj);
                }
            }
        });

        const ntChapters = [];
        ntBooks.forEach(book => {
            for (let i = 1; i <= book.chapters; i++) {
                ntChapters.push({ book: book.name, chapter: i, file: book.startFile + i - 1 });
            }
        });

        const days = [];
        let currentDate = new Date(startDate);
        let otIdx = 0;
        let ntIdx = 0;
        let psalmIdx = 0;
        let proverbIdx = 0;

        const otDays = (otChapters.length > 0 && otChaptersPerDay > 0) ? Math.ceil(otChapters.length / otChaptersPerDay) : 0;
        const ntDays = (ntChapters.length > 0 && ntChaptersPerDay > 0) ? Math.ceil(ntChapters.length / ntChaptersPerDay) : 0;
        const psalmDays = (psalmChapters.length > 0 && psalmsPerDay > 0) ? Math.ceil(psalmChapters.length / psalmsPerDay) : 0;
        const proverbDays = (proverbChapters.length > 0 && proverbsPerDay > 0) ? Math.ceil(proverbChapters.length / proverbsPerDay) : 0;

        const totalReadingDays = planOrder === 'mixed'
            ? Math.max(otDays, ntDays, psalmDays, proverbDays)
            : (otDays + ntDays + psalmDays + proverbDays);
        let readingDaysCount = 0;

        while (readingDaysCount < totalReadingDays) {
            if (!useDates || readingDays.includes(currentDate.getDay())) {
                const dayChapters = [];

                if (planOrder === 'mixed') {
                    // OT
                    for (let i = 0; i < otChaptersPerDay; i++) {
                        if (otIdx < otChapters.length) {
                            dayChapters.push(otChapters[otIdx++]);
                        } else if (padWithRepeats && otChapters.length > 0) {
                            dayChapters.push(otChapters[otIdx % otChapters.length]);
                            otIdx++;
                        }
                    }
                    // Psalms
                    for (let i = 0; i < psalmsPerDay; i++) {
                        if (psalmIdx < psalmChapters.length) {
                            dayChapters.push(psalmChapters[psalmIdx++]);
                        } else if (padWithRepeats && psalmChapters.length > 0) {
                            dayChapters.push(psalmChapters[psalmIdx % psalmChapters.length]);
                            psalmIdx++;
                        }
                    }
                    // Proverbs
                    for (let i = 0; i < proverbsPerDay; i++) {
                        if (proverbIdx < proverbChapters.length) {
                            dayChapters.push(proverbChapters[proverbIdx++]);
                        } else if (padWithRepeats && proverbChapters.length > 0) {
                            dayChapters.push(proverbChapters[proverbIdx % proverbChapters.length]);
                            proverbIdx++;
                        }
                    }
                    // NT
                    for (let i = 0; i < ntChaptersPerDay; i++) {
                        if (ntIdx < ntChapters.length) {
                            dayChapters.push(ntChapters[ntIdx++]);
                        } else if (padWithRepeats && ntChapters.length > 0) {
                            dayChapters.push(ntChapters[ntIdx % ntChapters.length]);
                            ntIdx++;
                        }
                    }
                } else {
                    // Sequential
                    const limit = otChaptersPerDay + ntChaptersPerDay + psalmsPerDay + proverbsPerDay;
                    for (let i = 0; i < limit; i++) {
                        if (otIdx < otChapters.length) {
                            dayChapters.push(otChapters[otIdx++]);
                        } else if (psalmIdx < psalmChapters.length) {
                            dayChapters.push(psalmChapters[psalmIdx++]);
                        } else if (proverbIdx < proverbChapters.length) {
                            dayChapters.push(proverbChapters[proverbIdx++]);
                        } else if (ntIdx < ntChapters.length) {
                            dayChapters.push(ntChapters[ntIdx++]);
                        }
                    }
                }

                if (dayChapters.length > 0) {
                    days.push({
                        date: useDates ? new Date(currentDate) : null,
                        chapters: dayChapters
                    });
                }
                readingDaysCount++;
            }
            if (useDates) {
                currentDate.setDate(currentDate.getDate() + 1);
            }
            if (days.length > 5000) break; // Safety break
        }

        return days;
    }, [selectionMode, selectedBooks, otChaptersPerDay, ntChaptersPerDay, psalmsPerDay, proverbsPerDay, planOrder, useDates, startDate, readingDays, padWithRepeats]);

    const generateEpub = async () => {
        setIsGenerating(true);
        setStatus('Starting EPUB generation...');
        try {
            const zip = new JSZip();
            zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

            const metaInf = zip.folder('META-INF');
            metaInf.file('container.xml', `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

            const oebps = zip.folder('OEBPS');
            const text = oebps.folder('Text');

            // Fetch styles
            const stylesheet = await fetch('bsb_unzipped/stylesheet.css').then(r => r.text());
            const pageStyles = await fetch('bsb_unzipped/page_styles.css').then(r => r.text());
            oebps.file('Styles/stylesheet.css', stylesheet);
            oebps.file('Styles/page_styles.css', pageStyles);

            const manifestItems = [
                '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
                '<item id="style" href="Styles/stylesheet.css" media-type="text/css"/>',
                '<item id="page-style" href="Styles/page_styles.css" media-type="text/css"/>'
            ];
            const spineItems = [];
            const navPoints = [];

            // Generate daily files
            for (let i = 0; i < plan.length; i++) {
                const day = plan[i];
                const dateStr = day.date ? day.date.toLocaleDateString() : '';
                const titleStr = day.date ? `Day ${i + 1} - ${dateStr}` : `Day ${i + 1}`;
                const fileName = `day_${i + 1}.xhtml`;
                setStatus(`Processing Day ${i + 1} of ${plan.length}...`);

                let bodyContent = `<h1>${titleStr}</h1>`;

                // Add summary section
                bodyContent += `<div class="day-summary" style="page-break-after: always; border-bottom: 2px solid #eee; margin-bottom: 2rem; padding-bottom: 2rem;">
                    <h2>Today's Readings</h2>
                    <ul style="list-style-type: none; padding: 0; font-size: 1.2em;">
                        ${day.chapters.map(ch => `<li style="margin-bottom: 0.5rem;"><strong>${ch.book} ${ch.chapter}</strong></li>`).join('')}
                    </ul>
                </div>`;

                for (const ch of day.chapters) {
                    const chContent = await fetchChapterContent(ch.file);
                    bodyContent += `<div class="chapter-container">
                        <h2>${ch.book} ${ch.chapter}</h2>
                        ${chContent}
                    </div>`;
                }

                // Construct the final XHTML string directly
                const finalContent = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title>${titleStr}</title>
<link rel="stylesheet" href="../Styles/stylesheet.css" type="text/css"/>
<link rel="stylesheet" href="../Styles/page_styles.css" type="text/css"/>
</head>
<body>
${bodyContent}
</body>
</html>`;

                text.file(fileName, finalContent);
                manifestItems.push(`<item id="day_${i + 1}" href="Text/${fileName}" media-type="application/xhtml+xml"/>`);
                spineItems.push(`<itemref idref="day_${i + 1}"/>`);
                navPoints.push(`<navPoint id="nav_${i + 1}" playOrder="${i + 1}">
                    <navLabel><text>${titleStr}</text></navLabel>
                    <content src="Text/${fileName}"/>
                </navPoint>`);
            }

            // content.opf
            oebps.file('content.opf', `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="uuid_id" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:title>Bible Reading Plan</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="uuid_id" opf:scheme="uuid">bible-plan-${Date.now()}</dc:identifier>
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${spineItems.join('\n    ')}
  </spine>
</package>`);

            // toc.ncx
            oebps.file('toc.ncx', `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="bible-plan-${Date.now()}"/>
    <meta name="dtb:depth" content="1"/>
  </head>
  <docTitle><text>Bible Reading Plan</text></docTitle>
  <navMap>
    ${navPoints.join('\n    ')}
  </navMap>
</ncx>`);

            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'bible_reading_plan.epub';
            a.click();
            setStatus('EPUB generated successfully!');
        } catch (err) {
            console.error(err);
            setStatus('Error generating EPUB: ' + err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const fetchChapterContent = async (fileNum) => {
        const url = `bsb_unzipped/bsb - final - 7-18-21/OEBPS/Text/${fileNum}.htm`;
        const response = await fetch(url);
        const htmlText = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');

        // Remove navigation and headers
        const toRemove = ['#topheading', '.bsbheading', '.cross', '.nav', 'h1'];
        toRemove.forEach(selector => {
            const elements = doc.querySelectorAll(selector);
            elements.forEach(el => el.remove());
        });

        // Serialize the body's children to XHTML to ensure all tags are closed
        const serializer = new XMLSerializer();
        let xhtmlFragment = "";
        for (const child of doc.body.childNodes) {
            xhtmlFragment += serializer.serializeToString(child);
        }
        return xhtmlFragment;
    };

    return html`
        <div>
            <section>
                <h2>Reading Selection</h2>
                <div class="grid">
                    <label>
                        <input type="radio" name="selectionMode" value="all" checked=${selectionMode === 'all'} onChange=${() => setSelectionMode('all')} />
                        All Bible
                    </label>
                    <label>
                        <input type="radio" name="selectionMode" value="custom" checked=${selectionMode === 'custom'} onChange=${() => setSelectionMode('custom')} />
                        Custom Selection
                    </label>
                </div>

                ${selectionMode === 'custom' && html`
                    <div>
                        <div class="grid">
                            <button type="button" onClick=${() => setPreset('gospels')}>Gospels</button>
                            <button type="button" onClick=${() => setPreset('pentateuch')}>Pentateuch</button>
                            <button type="button" onClick=${() => setPreset('paul')}>Paul's Letters</button>
                            <button type="button" onClick=${() => setPreset('wisdom')}>Wisdom Books</button>
                        </div>
                        <div class="book-selection">
                            ${BIBLE_BOOKS.map(book => html`
                                <label class="book-item">
                                    <input type="checkbox" checked=${selectedBooks.includes(book.name)} onChange=${() => toggleBook(book.name)} />
                                    ${book.name}
                                </label>
                            `)}
                        </div>
                    </div>
                `}

                <div class="grid">
                    <label>OT Chapters per day:
                        <input type="number" value=${otChaptersPerDay} onInput=${(e) => setOtChaptersPerDay(parseInt(e.target.value) || 0)} min="0" />
                    </label>
                    <label>NT Chapters per day:
                        <input type="number" value=${ntChaptersPerDay} onInput=${(e) => setNtChaptersPerDay(parseInt(e.target.value) || 0)} min="0" />
                    </label>
                    <label>Psalms per day:
                        <input type="number" value=${psalmsPerDay} onInput=${(e) => setPsalmsPerDay(parseInt(e.target.value) || 0)} min="0" />
                    </label>
                    <label>Proverbs per day:
                        <input type="number" value=${proverbsPerDay} onInput=${(e) => setProverbsPerDay(parseInt(e.target.value) || 0)} min="0" />
                    </label>
                </div>
            </section>

            <section>
                <h2>Plan Style</h2>
                <div class="grid" style="align-items: end;">
                    <label>Order:
                        <select value=${planOrder} onChange=${(e) => setPlanOrder(e.target.value)}>
                            <option value="mixed">Mixed (OT and NT together)</option>
                            <option value="sequential">Sequential (OT then NT)</option>
                        </select>
                    </label>
                    <div style="margin-bottom: var(--spacing);">
                        <label>
                            <input type="checkbox" checked=${useDates} onChange=${(e) => setUseDates(e.target.checked)} />
                            Use Dates
                        </label>
                    </div>
                </div>

                ${planOrder === 'mixed' && html`
                    <div style="margin-bottom: var(--spacing); padding: 1rem; border: 1px solid var(--muted-border-color); border-radius: var(--border-radius);">
                        <label style="margin-bottom: 0.5rem;">
                            <input type="checkbox" checked=${padWithRepeats} onChange=${(e) => setPadWithRepeats(e.target.checked)} />
                            Repeat shorter section to keep daily mix
                        </label>
                        <small style="display: block; margin-left: 2rem; color: var(--muted-color); line-height: 1.4;">
                            If one part of the Bible (like the New Testament) is finished before the other,
                            it will start over from the beginning so you always have both OT and NT readings every day.
                        </small>
                    </div>
                `}

                ${useDates && html`
                    <div class="grid">
                        <label>Start Date:
                            <input type="date" value=${startDate} onChange=${(e) => setStartDate(e.target.value)} />
                        </label>
                        <div>
                            <label>Reading Days:</label>
                            <div class="day-selection">
                                ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((name, i) => html`
                                    <label class="day-item">
                                        <input type="checkbox" checked=${readingDays.includes(i)} onChange=${() => toggleDay(i)} />
                                        ${name}
                                    </label>
                                `)}
                            </div>
                        </div>
                    </div>
                `}
            </section>

            <section>
                <h2>Plan Preview</h2>
                <p>${plan.length} days total</p>
                <div style="max-height: 400px; overflow-y: auto; border: 1px solid var(--muted-border-color); padding: 1rem; margin-bottom: 1rem; border-radius: var(--border-radius);">
                    ${plan.slice(0, 5).map((day, i) => html`
                        <div class="preview-item">
                            <span class="preview-date">${day.date ? day.date.toLocaleDateString() : `Day ${i + 1}`}</span>
                            <span>${day.chapters.map(c => `${c.book} ${c.chapter}`).join(', ')}</span>
                        </div>
                    `)}

                    ${plan.length > 10 ? html`
                        <div style="text-align: center; padding: 1rem; color: var(--muted-color); border-bottom: 1px solid var(--muted-border-color);">
                            ... ${plan.length - 10} days omitted ...
                        </div>
                        ${plan.slice(-5).map((day, i) => html`
                            <div class="preview-item">
                                <span class="preview-date">${day.date ? day.date.toLocaleDateString() : `Day ${plan.length - 4 + i}`}</span>
                                <span>${day.chapters.map(c => `${c.book} ${c.chapter}`).join(', ')}</span>
                            </div>
                        `)}
                    ` : plan.slice(5).map((day, i) => html`
                        <div class="preview-item">
                            <span class="preview-date">${day.date ? day.date.toLocaleDateString() : `Day ${6 + i}`}</span>
                            <span>${day.chapters.map(c => `${c.book} ${c.chapter}`).join(', ')}</span>
                        </div>
                    `)}
                </div>
                <button onClick=${generateEpub} disabled=${isGenerating || plan.length === 0}>
                    ${isGenerating ? 'Generating...' : 'Download EPUB'}
                </button>
                ${status && html`<p><small>${status}</small></p>`}
            </section>
        </div>
    `;
};

render(html`<${App} />`, document.getElementById('app'));
