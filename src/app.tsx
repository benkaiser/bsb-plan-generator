import { render } from 'preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import { JSX } from 'preact';
import JSZip from 'jszip';
import { bibleData as BIBLE_BOOKS } from './bibleData';
import type { BibleBook } from './bibleData';
import {
    assignDates,
    buildGroupDays,
    buildScheduledDays,
    filterChapterHtml,
    formatChapter,
    hasPartialChapters
} from './planLogic';
import type { Chapter, Day, ReadingGroup } from './planLogic';
import { PRESET_PLANS, getPresetPlan } from './presetPlans';
import type { PresetPlanId } from './presetPlans';

// Extend Window interface for File System Access API
declare global {
    interface Window {
        showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
    }
}

interface AudioStats {
    uniqueChapters: number;
    totalChapters: number;
    downloadSizeMB: number;
    totalSizeMB: number;
}

type SelectionMode = 'all' | 'custom';
type PlanOrder = 'mixed' | 'sequential' | 'groups';
type PlanType = 'custom' | PresetPlanId;
type Preset = 'all' | 'none' | 'gospels' | 'pentateuch' | 'history' | 'wisdom' | 'major-prophets' | 'minor-prophets' | 'paul' | 'general-epistles';
type BibleVersion = 'bsb' | 'kjv';

interface ChapterWithIndex {
    dayIdx: number;
    chIdx: number;
    file: number;
    book: string;
    chapter: number;
}

const DEFAULT_GROUPS: ReadingGroup[] = [
    { id: 1, name: 'Old Testament', books: BIBLE_BOOKS.slice(0, 39).map(b => b.name), chaptersPerDay: 3, repeat: false },
    { id: 2, name: 'New Testament', books: BIBLE_BOOKS.slice(39).map(b => b.name), chaptersPerDay: 1, repeat: false }
];

const App = () => {
    const [bibleVersion, setBibleVersion] = useState<BibleVersion>('bsb');
    const [planType, setPlanType] = useState<PlanType>('custom');
    const [selectionMode, setSelectionMode] = useState<SelectionMode>('all');
    const [selectedBooks, setSelectedBooks] = useState<string[]>(BIBLE_BOOKS.map(b => b.name));
    const [otChaptersPerDay, setOtChaptersPerDay] = useState<number>(3);
    const [ntChaptersPerDay, setNtChaptersPerDay] = useState<number>(1);
    const [psalmsPerDay, setPsalmsPerDay] = useState<number>(1);
    const [proverbsPerDay, setProverbsPerDay] = useState<number>(1);
    const [splitPsalms, setSplitPsalms] = useState<boolean>(false);
    const [splitProverbs, setSplitProverbs] = useState<boolean>(false);
    const [planOrder, setPlanOrder] = useState<PlanOrder>('mixed');
    const [customGroups, setCustomGroups] = useState<ReadingGroup[]>(DEFAULT_GROUPS);
    const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
    const [cycleDays, setCycleDays] = useState<number>(365);
    const [padWithRepeats, setPadWithRepeats] = useState<boolean>(false);
    const [useDates, setUseDates] = useState<boolean>(true);
    const [startDate, setStartDate] = useState<string>(() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });
    const [readingDays, setReadingDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
    const [status, setStatus] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState<boolean>(false);

    const toggleBook = (bookName: string): void => {
        setSelectedBooks(prev =>
            prev.includes(bookName)
                ? prev.filter(b => b !== bookName)
                : [...prev, bookName]
        );
    };

    const setPreset = (preset: Preset): void => {
        setSelectionMode('custom');
        let booksToToggle: string[] = [];
        if (preset === 'all') {
            setSelectedBooks(BIBLE_BOOKS.map(b => b.name));
            return;
        } else if (preset === 'none') {
            setSelectedBooks([]);
            return;
        } else if (preset === 'gospels') {
            booksToToggle = ['Matthew', 'Mark', 'Luke', 'John'];
        } else if (preset === 'pentateuch') {
            booksToToggle = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'];
        } else if (preset === 'history') {
            booksToToggle = ['Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther'];
        } else if (preset === 'wisdom') {
            booksToToggle = ['Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Songs'];
        } else if (preset === 'major-prophets') {
            booksToToggle = ['Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel'];
        } else if (preset === 'minor-prophets') {
            booksToToggle = ['Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'];
        } else if (preset === 'paul') {
            booksToToggle = ['Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon'];
        } else if (preset === 'general-epistles') {
            booksToToggle = ['Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'];
        }

        setSelectedBooks(prev => {
            const allPresent = booksToToggle.every(b => prev.includes(b));
            if (allPresent) {
                return prev.filter(b => !booksToToggle.includes(b));
            } else {
                return [...new Set([...prev, ...booksToToggle])];
            }
        });
    };

    const toggleDay = (day: number): void => {
        setReadingDays(prev =>
            prev.includes(day)
                ? prev.filter(d => d !== day)
                : [...prev, day].sort()
        );
    };

    const updateGroup = (id: number, changes: Partial<ReadingGroup>): void => {
        setCustomGroups(prev => prev.map(group => group.id === id ? { ...group, ...changes } : group));
    };

    const addGroup = (): void => {
        setCustomGroups(prev => {
            const id = prev.reduce((max, group) => Math.max(max, group.id), 0) + 1;
            setExpandedGroup(id);
            return [...prev, { id, name: `Group ${prev.length + 1}`, books: [], chaptersPerDay: 1, repeat: false }];
        });
    };

    const removeGroup = (id: number): void => {
        setCustomGroups(prev => prev.filter(group => group.id !== id));
    };

    const toggleGroupBook = (id: number, bookName: string): void => {
        setCustomGroups(prev => prev.map(group => {
            if (group.id !== id) return group;
            const books = group.books.includes(bookName)
                ? group.books.filter(b => b !== bookName)
                : [...group.books, bookName];
            return { ...group, books };
        }));
    };

    const plan = useMemo((): Day[] => {
        const dateOptions = { useDates, startDate, readingDays };

        if (planType !== 'custom') {
            const preset = getPresetPlan(planType);
            const days = preset.schedule
                ? buildScheduledDays(preset.schedule)
                : buildGroupDays(preset.groups ?? [], cycleDays);
            return assignDates(days, dateOptions);
        }

        if (planOrder === 'groups') {
            const everyGroupRepeats = customGroups.length > 0 && customGroups.every(group => group.repeat);
            return assignDates(buildGroupDays(customGroups, everyGroupRepeats ? cycleDays : undefined), dateOptions);
        }

        const booksToInclude = selectionMode === 'all' ? BIBLE_BOOKS : BIBLE_BOOKS.filter(b => selectedBooks.includes(b.name));
        if (booksToInclude.length === 0) return [];

        const otBooks = booksToInclude.filter(b => BIBLE_BOOKS.indexOf(b) < 39);
        const ntBooks = booksToInclude.filter(b => BIBLE_BOOKS.indexOf(b) >= 39);

        const otChapters: Chapter[] = [];
        const psalmChapters: Chapter[] = [];
        const proverbChapters: Chapter[] = [];

        otBooks.forEach(book => {
            for (let i = 1; i <= book.chapters; i++) {
                const chapterObj: Chapter = { book: book.name, chapter: i, file: book.startFile + i - 1 };
                if (book.name === 'Psalms' && splitPsalms) {
                    psalmChapters.push(chapterObj);
                } else if (book.name === 'Proverbs' && splitProverbs) {
                    proverbChapters.push(chapterObj);
                } else {
                    otChapters.push(chapterObj);
                }
            }
        });

        const ntChapters: Chapter[] = [];
        ntBooks.forEach(book => {
            for (let i = 1; i <= book.chapters; i++) {
                ntChapters.push({ book: book.name, chapter: i, file: book.startFile + i - 1 });
            }
        });

        const days: Day[] = [];
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
                const dayChapters: Chapter[] = [];

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
    }, [planType, cycleDays, customGroups, selectionMode, selectedBooks, otChaptersPerDay, ntChaptersPerDay, psalmsPerDay, proverbsPerDay, splitPsalms, splitProverbs, planOrder, useDates, startDate, readingDays, padWithRepeats]);

    const planHasPartialChapters = useMemo((): boolean => hasPartialChapters(plan), [plan]);

    const audioStats = useMemo((): AudioStats => {
        const allChapters = plan.flatMap(day => day.chapters.map(ch => ch.file));
        const uniqueChapters = new Set(allChapters).size;
        const totalChapters = allChapters.length;
        return {
            uniqueChapters,
            totalChapters,
            downloadSizeMB: uniqueChapters,
            totalSizeMB: totalChapters
        };
    }, [plan]);

    const generateEpub = async (): Promise<void> => {
        setIsGenerating(true);
        setStatus('Starting EPUB generation...');
        try {
            const zip = new JSZip();
            zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

            const metaInf = zip.folder('META-INF');
            if (!metaInf) throw new Error('Failed to create META-INF folder');
            metaInf.file('container.xml', `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

            const oebps = zip.folder('OEBPS');
            if (!oebps) throw new Error('Failed to create OEBPS folder');
            const text = oebps.folder('Text');
            if (!text) throw new Error('Failed to create Text folder');

            // Fetch styles
            const stylesheet = await fetch('bsb_unzipped/stylesheet.css').then(r => r.text());
            const pageStyles = await fetch('bsb_unzipped/page_styles.css').then(r => r.text());
            oebps.file('Styles/stylesheet.css', stylesheet);
            oebps.file('Styles/page_styles.css', pageStyles);

            const manifestItems: string[] = [
                '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
                '<item id="style" href="Styles/stylesheet.css" media-type="text/css"/>',
                '<item id="page-style" href="Styles/page_styles.css" media-type="text/css"/>'
            ];
            const spineItems: string[] = [];
            const navPoints: string[] = [];

            // Pre-fetch all unique chapters in parallel
            const uniqueFiles = [...new Set(plan.flatMap(day => day.chapters.map(ch => ch.file)))];
            const chapterCache = new Map<number, string>();
            const CONCURRENCY = 100;

            for (let i = 0; i < uniqueFiles.length; i += CONCURRENCY) {
                const chunk = uniqueFiles.slice(i, i + CONCURRENCY);
                setStatus(`Pre-fetching chapters ${i + 1} to ${Math.min(i + CONCURRENCY, uniqueFiles.length)} of ${uniqueFiles.length}...`);
                await Promise.all(chunk.map(async (file) => {
                    const content = await fetchChapterContent(file);
                    chapterCache.set(file, content);
                }));
            }

            // Generate daily files
            for (let i = 0; i < plan.length; i++) {
                const day = plan[i];
                const dateStr = day.date ? day.date.toLocaleDateString() : '';
                const titleStr = day.date ? `Day ${i + 1} - ${dateStr}` : `Day ${i + 1}`;
                const fileName = `day_${i + 1}.xhtml`;
                setStatus(`Assembling Day ${i + 1} of ${plan.length}...`);

                let bodyContent = `<h1>${titleStr}</h1>`;

                // Add summary section
                bodyContent += `<div class="day-summary" style="page-break-after: always; border-bottom: 2px solid #eee; margin-bottom: 2rem; padding-bottom: 2rem;">
                    <h2>Today's Readings</h2>
                    <ul style="list-style-type: none; padding: 0; font-size: 1.2em;">
                        ${day.chapters.map(ch => `<li style="margin-bottom: 0.5rem;"><strong>${formatChapter(ch)}</strong></li>`).join('')}
                    </ul>
                </div>`;

                for (const ch of day.chapters) {
                    const chContent = filterChapterHtml(chapterCache.get(ch.file) ?? '', ch.startVerse, ch.endVerse);
                    bodyContent += `<div class="chapter-container">
                        <h2>${formatChapter(ch)}</h2>
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

            // Generate credits page
            const creditsFileName = 'credits.xhtml';
            const versionName = bibleVersion === 'bsb' ? 'Berean Standard Bible (BSB)' : 'King James Version (KJV)';
            const licenseInfo = bibleVersion === 'bsb'
                ? '<p><strong>Berean Standard Bible (BSB):</strong> The Berean Standard Bible is public domain. <a href="https://berean.bible/">https://berean.bible/</a></p>'
                : '<p><strong>King James Version (KJV):</strong> The King James Version is in the public domain in most of the world.</p>';

            const creditsContent = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title>Credits</title>
<link rel="stylesheet" href="../Styles/stylesheet.css" type="text/css"/>
<link rel="stylesheet" href="../Styles/page_styles.css" type="text/css"/>
</head>
<body>
<h1>Credits</h1>
<p>This Bible reading plan was generated using the <strong>Bible Reading Plan Generator</strong>.</p>
<p>
    <strong>Source Code:</strong> <a href="https://github.com/benkaiser/bsb-plan-generator">https://github.com/benkaiser/bsb-plan-generator</a><br/>
    <strong>Website:</strong> <a href="https://benkaiser.github.io/bsb-plan-generator/">https://benkaiser.github.io/bsb-plan-generator/</a>
</p>
<h2>License Information</h2>
${licenseInfo}
</body>
</html>`;
            text.file(creditsFileName, creditsContent);
            manifestItems.push(`<item id="credits" href="Text/${creditsFileName}" media-type="application/xhtml+xml"/>`);
            spineItems.push(`<itemref idref="credits"/>`);
            navPoints.push(`<navPoint id="nav_credits" playOrder="${plan.length + 1}">
                <navLabel><text>Credits</text></navLabel>
                <content src="Text/${creditsFileName}"/>
            </navPoint>`);

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

            const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'bible_reading_plan.epub';
            a.click();
            setStatus('EPUB generated successfully!');
        } catch (err) {
            console.error(err);
            setStatus('Error generating EPUB: ' + (err as Error).message);
        } finally {
            setIsGenerating(false);
        }
    };

    const generateAudiobook = async (): Promise<void> => {
        if (planHasPartialChapters) {
            alert('This plan includes readings that only cover part of a chapter, which the chapter based audio recordings cannot represent. Please generate an EPUB instead.');
            return;
        }

        if (!('showDirectoryPicker' in window)) {
            alert('Audiobook generation is only supported in Chrome and Edge. Firefox and Safari do not yet support the necessary File System APIs.');
            return;
        }

        let dirHandle: FileSystemDirectoryHandle;
        try {
            dirHandle = await window.showDirectoryPicker();
        } catch (err) {
            if ((err as Error).name === 'AbortError') return;
            throw err;
        }

        setIsGenerating(true);
        setStatus('Starting Audiobook generation...');
        try {
            const padLength = plan.length.toString().length;
            const CHUNK_SIZE = 20; // Max parallel download connections

            const allChapters: ChapterWithIndex[] = [];
            plan.forEach((day, dayIdx) => {
                day.chapters.forEach((ch, chIdx) => {
                    allChapters.push({ dayIdx, chIdx, file: ch.file, book: ch.book, chapter: ch.chapter });
                });
            });

            const dayChapterBlobs: (Blob[] | null)[] = plan.map(day => new Array(day.chapters.length));
            const dayChaptersFinished: number[] = new Array(plan.length).fill(0);
            let chapterIdx = 0;
            let writeIndex = 0;
            let error: Error | null = null;

            const downloadWorker = async (): Promise<void> => {
                while (chapterIdx < allChapters.length && !error) {
                    const currentChapter = allChapters[chapterIdx];
                    // Limit lookahead to 20 days ahead of the current writer to save memory
                    if (currentChapter.dayIdx - writeIndex > 20) {
                        await new Promise(r => setTimeout(r, 500));
                        continue;
                    }

                    const { dayIdx, chIdx, file, book, chapter } = allChapters[chapterIdx++];
                    try {
                        const response = await fetch(`audio_processed/${file}.mp3`);
                        if (!response.ok) throw new Error(`Failed to fetch audio for ${book} ${chapter}`);
                        const blob = await response.blob();
                        const blobArray = dayChapterBlobs[dayIdx] as Blob[];
                        blobArray[chIdx] = blob;
                        dayChaptersFinished[dayIdx]++;
                    } catch (e) {
                        error = e as Error;
                    }
                }
            };

            // Start the parallel download workers
            const workers = Array.from({ length: CHUNK_SIZE }, downloadWorker);

            // Serial write loop
            for (let i = 0; i < plan.length; i++) {
                // Wait for all chapters of this day to be downloaded
                while (dayChaptersFinished[i] < plan[i].chapters.length && !error) {
                    await new Promise(r => setTimeout(r, 100));
                }
                if (error) throw error;

                const day = plan[i];
                const dayNum = (i + 1).toString().padStart(padLength, '0');

                const prefix = `Day_${dayNum}_`;
                const ext = `.mp3`;
                const maxSummaryLength = 28 - prefix.length - ext.length;

                const chaptersSummary = day.chapters.map(ch => {
                    const shortBook = ch.book.substring(0, 3);
                    return `${shortBook}${ch.chapter}`;
                }).join('_');

                const safeSummary = chaptersSummary.replace(/[^a-z0-9_]/gi, '').substring(0, maxSummaryLength);
                const fileName = `${prefix}${safeSummary}${ext}`;

                setStatus(`Generating Audiobook: ${i + 1} / ${plan.length} days...`);

                const concatenatedBlob = new Blob(dayChapterBlobs[i] as Blob[], { type: 'audio/mpeg' });
                const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable({ keepExistingData: false });
                await writable.write(concatenatedBlob);
                await writable.close();

                dayChapterBlobs[i] = null; // Free memory
                writeIndex = i;
            }

            const creditsText = `BSB Bible Reading Plan - Credits

This plan was generated using the BSB Bible Plan Generator.

Source Code: https://github.com/benkaiser/bsb-plan-generator
Website: https://benkaiser.github.io/bsb-plan-generator/

License Information:
- Berean Standard Bible (BSB): The Berean Standard Bible is public domain. https://berean.bible/
- Bible Audio: The audio recording is by Barry Hays and has also been placed in the public domain.
`;
            const creditsHandle = await dirHandle.getFileHandle('CREDITS.txt', { create: true });
            const creditsWritable = await creditsHandle.createWritable();
            await creditsWritable.write(creditsText);
            await creditsWritable.close();

            // Write cover image
            try {
                const coverResponse = await fetch('img/cover.jpg');
                if (coverResponse.ok) {
                    const coverBlob = await coverResponse.blob();
                    const coverHandle = await dirHandle.getFileHandle('cover.jpg', { create: true });
                    const coverWritable = await coverHandle.createWritable();
                    await coverWritable.write(coverBlob);
                    await coverWritable.close();
                }
            } catch (e) {
                console.error('Failed to write cover image', e);
            }

            await Promise.all(workers);
            setStatus('Audiobook generated successfully!');
        } catch (err) {
            console.error(err);
            setStatus('Error generating audiobook: ' + (err as Error).message);
        } finally {
            setIsGenerating(false);
        }
    };

    const fetchChapterContent = async (fileNum: number): Promise<string> => {
        const basePath = bibleVersion === 'bsb'
            ? 'bsb_unzipped/bsb - final - 7-18-21/OEBPS/Text'
            : 'kjv_unzipped/kjv/OEBPS/Text';
        const url = `${basePath}/${fileNum}.htm`;
        const response = await fetch(url);
        const htmlText = await response.text();

        // Extract body content - assumes preprocessing has already cleaned the files
        const bodyMatch = htmlText.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        return bodyMatch ? bodyMatch[1] : '';
    };

    return (
        <div>
            <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <h1>Bible Reading Plan Generator</h1>
                <p>Generate custom EPUB reading plans and daily Audiobooks from the Bible.</p>
            </header>

            <section>
                <h2>1. Bible Version</h2>
                <div class="grid">
                    <label>
                        <input type="radio" name="bibleVersion" value="bsb" checked={bibleVersion === 'bsb'} onChange={() => setBibleVersion('bsb')} />
                        BSB (Berean Standard Bible)
                    </label>
                    <label>
                        <input type="radio" name="bibleVersion" value="kjv" checked={bibleVersion === 'kjv'} onChange={() => setBibleVersion('kjv')} />
                        KJV (King James Version)
                    </label>
                </div>
                <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--muted-color)' }}>
                    {bibleVersion === 'bsb'
                        ? 'The Berean Standard Bible is a high-quality, modern English translation that has been dedicated to the public domain.'
                        : 'The King James Version is a classic English translation widely used for centuries.'}
                </p>
            </section>

            <section>
                <h2>2. Reading Selection</h2>
                <label>Reading Plan:
                    <select value={planType} onChange={(e: JSX.TargetedEvent<HTMLSelectElement>) => setPlanType(e.currentTarget.value as PlanType)}>
                        <option value="custom">Custom plan</option>
                        {PRESET_PLANS.map(preset => (
                            <option value={preset.id} key={preset.id}>{preset.name}</option>
                        ))}
                    </select>
                </label>

                {planType !== 'custom' && (
                    <div style={{ marginBottom: 'var(--spacing)' }}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--muted-color)' }}>{getPresetPlan(planType).description}</p>
                        {getPresetPlan(planType).groups && (
                            <>
                                <div class="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem' }}>
                                    {getPresetPlan(planType).groups!.map(group => (
                                        <small key={group.id}>{group.id}. {group.name}</small>
                                    ))}
                                </div>
                                <label style={{ marginTop: '1rem' }}>Number of days:
                                    <input type="number" value={cycleDays} onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => setCycleDays(parseInt(e.currentTarget.value) || 0)} min="1" />
                                </label>
                            </>
                        )}
                    </div>
                )}

                {planType === 'custom' && planOrder === 'groups' && (
                    <p style={{ fontSize: '0.9rem', color: 'var(--muted-color)' }}>
                        Your reading groups (which books, and how many chapters a day from each) are configured under <strong>Plan Style</strong> below.
                    </p>
                )}

                {planType === 'custom' && planOrder !== 'groups' && (
                <>
                <div class="grid">
                    <label>
                        <input type="radio" name="selectionMode" value="all" checked={selectionMode === 'all'} onChange={() => setSelectionMode('all')} />
                        Whole Bible
                    </label>
                    <label>
                        <input type="radio" name="selectionMode" value="custom" checked={selectionMode === 'custom'} onChange={() => setSelectionMode('custom')} />
                        Custom Selection
                    </label>
                </div>

                {selectionMode === 'custom' && (
                    <div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--muted-border-color)', paddingBottom: '1rem' }}>
                            <button type="button" class="outline secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', marginBottom: 0, width: 'auto' }} onClick={() => setPreset('all')}>Select All</button>
                            <button type="button" class="outline secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', marginBottom: 0, width: 'auto' }} onClick={() => setPreset('none')}>Select None</button>
                        </div>
                        <div class="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
                            <button type="button" style={{ padding: '0.5rem', fontSize: '0.85rem', marginBottom: 0 }} onClick={() => setPreset('pentateuch')}>Pentateuch</button>
                            <button type="button" style={{ padding: '0.5rem', fontSize: '0.85rem', marginBottom: 0 }} onClick={() => setPreset('history')}>History</button>
                            <button type="button" style={{ padding: '0.5rem', fontSize: '0.85rem', marginBottom: 0 }} onClick={() => setPreset('wisdom')}>Wisdom</button>
                            <button type="button" style={{ padding: '0.5rem', fontSize: '0.85rem', marginBottom: 0 }} onClick={() => setPreset('major-prophets')}>Major Prophets</button>
                            <button type="button" style={{ padding: '0.5rem', fontSize: '0.85rem', marginBottom: 0 }} onClick={() => setPreset('minor-prophets')}>Minor Prophets</button>
                            <button type="button" style={{ padding: '0.5rem', fontSize: '0.85rem', marginBottom: 0 }} onClick={() => setPreset('gospels')}>Gospels</button>
                            <button type="button" style={{ padding: '0.5rem', fontSize: '0.85rem', marginBottom: 0 }} onClick={() => setPreset('paul')}>Paul's Letters</button>
                            <button type="button" style={{ padding: '0.5rem', fontSize: '0.85rem', marginBottom: 0 }} onClick={() => setPreset('general-epistles')}>General Epistles</button>
                        </div>
                        <div class="book-selection">
                            {BIBLE_BOOKS.map((book: BibleBook) => (
                                <label class="book-item" key={book.name}>
                                    <input type="checkbox" checked={selectedBooks.includes(book.name)} onChange={() => toggleBook(book.name)} />
                                    {book.name}
                                </label>
                            ))}
                        </div>
                    </div>
                )}

                <div class="grid">
                    <label>OT Chapters per day:
                        <input type="number" value={otChaptersPerDay} onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => setOtChaptersPerDay(parseInt(e.currentTarget.value) || 0)} min="0" />
                    </label>
                    <label>NT Chapters per day:
                        <input type="number" value={ntChaptersPerDay} onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => setNtChaptersPerDay(parseInt(e.currentTarget.value) || 0)} min="0" />
                    </label>
                    {splitPsalms && (
                        <label>Psalms per day:
                            <input type="number" value={psalmsPerDay} onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => setPsalmsPerDay(parseInt(e.currentTarget.value) || 0)} min="1" />
                        </label>
                    )}
                    {splitProverbs && (
                        <label>Proverbs per day:
                            <input type="number" value={proverbsPerDay} onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => setProverbsPerDay(parseInt(e.currentTarget.value) || 0)} min="1" />
                        </label>
                    )}
                </div>

                <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                    <button type="button" class={splitPsalms ? '' : 'outline'} onClick={() => setSplitPsalms(!splitPsalms)}>
                        {splitPsalms ? '✓ Psalms Split Out' : 'Split out Psalms'}
                    </button>
                    <button type="button" class={splitProverbs ? '' : 'outline'} onClick={() => setSplitProverbs(!splitProverbs)}>
                        {splitProverbs ? '✓ Proverbs Split Out' : 'Split out Proverbs'}
                    </button>
                </div>
                </>
                )}
            </section>

            <section>
                <h2>3. Plan Style</h2>
                <div class="grid" style={{ alignItems: 'end' }}>
                    {planType === 'custom' && (
                        <label>Order:
                            <select value={planOrder} onChange={(e: JSX.TargetedEvent<HTMLSelectElement>) => setPlanOrder(e.currentTarget.value as PlanOrder)}>
                                <option value="mixed">Mixed (OT and NT together)</option>
                                <option value="sequential">Sequential (OT then NT)</option>
                                <option value="groups">Custom Groups</option>
                            </select>
                        </label>
                    )}
                    <div style={{ marginBottom: 'var(--spacing)' }}>
                        <label>
                            <input type="checkbox" checked={useDates} onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => setUseDates(e.currentTarget.checked)} />
                            Use Dates
                        </label>
                    </div>
                </div>

                {planType === 'custom' && planOrder === 'groups' && (
                    <div style={{ marginBottom: 'var(--spacing)' }}>
                        <small style={{ display: 'block', marginBottom: '1rem', color: 'var(--muted-color)', lineHeight: 1.4 }}>
                            Each group is read side by side: every day you read the chosen number of chapters from each group,
                            in the order the books appear in the Bible.
                        </small>

                        {customGroups.map(group => (
                            <article key={group.id} style={{ padding: '1rem', marginBottom: '1rem' }}>
                                <div class="grid" style={{ alignItems: 'end' }}>
                                    <label>Group name:
                                        <input type="text" value={group.name} onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => updateGroup(group.id, { name: e.currentTarget.value })} />
                                    </label>
                                    <label>Chapters per day:
                                        <input type="number" value={group.chaptersPerDay} min="0" onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => updateGroup(group.id, { chaptersPerDay: parseInt(e.currentTarget.value) || 0 })} />
                                    </label>
                                </div>
                                <label>
                                    <input type="checkbox" checked={group.repeat} onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => updateGroup(group.id, { repeat: e.currentTarget.checked })} />
                                    Start this group again once it is finished
                                </label>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <button type="button" class="outline secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', marginBottom: 0, width: 'auto' }} onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}>
                                        {expandedGroup === group.id ? 'Hide books' : `Choose books (${group.books.length} selected)`}
                                    </button>
                                    <button type="button" class="outline secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', marginBottom: 0, width: 'auto' }} onClick={() => updateGroup(group.id, { books: [] })}>Clear books</button>
                                    <button type="button" class="outline contrast" style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', marginBottom: 0, width: 'auto' }} onClick={() => removeGroup(group.id)}>Remove group</button>
                                </div>
                                {expandedGroup === group.id && (
                                    <div class="book-selection" style={{ marginTop: '1rem' }}>
                                        {BIBLE_BOOKS.map((book: BibleBook) => (
                                            <label class="book-item" key={book.name}>
                                                <input type="checkbox" checked={group.books.includes(book.name)} onChange={() => toggleGroupBook(group.id, book.name)} />
                                                {book.name}
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </article>
                        ))}

                        <div class="grid" style={{ alignItems: 'end' }}>
                            <button type="button" class="outline" onClick={addGroup}>Add group</button>
                            {customGroups.length > 0 && customGroups.every(group => group.repeat) && (
                                <label>Number of days:
                                    <input type="number" value={cycleDays} min="1" onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => setCycleDays(parseInt(e.currentTarget.value) || 0)} />
                                </label>
                            )}
                        </div>
                    </div>
                )}

                {planType === 'custom' && planOrder === 'mixed' && (
                    <div style={{ marginBottom: 'var(--spacing)', padding: '1rem', border: '1px solid var(--muted-border-color)', borderRadius: 'var(--border-radius)' }}>
                        <label style={{ marginBottom: '0.5rem' }}>
                            <input type="checkbox" checked={padWithRepeats} onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => setPadWithRepeats(e.currentTarget.checked)} />
                            Repeat shorter section to keep daily mix
                        </label>
                        <small style={{ display: 'block', marginLeft: '2rem', color: 'var(--muted-color)', lineHeight: 1.4 }}>
                            If one part of the Bible (like the New Testament) is finished before the other,
                            it will start over from the beginning so you always have both OT and NT readings every day.
                        </small>
                    </div>
                )}

                {useDates && (
                    <div class="grid">
                        <label>Start Date:
                            <input type="date" value={startDate} onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => setStartDate(e.currentTarget.value)} />
                        </label>
                        <div>
                            <label>Reading Days:</label>
                            <div class="day-selection">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((name, i) => (
                                    <label class="day-item" key={i}>
                                        <input type="checkbox" checked={readingDays.includes(i)} onChange={() => toggleDay(i)} />
                                        {name}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </section>

            <section>
                <h2>4. Generate Plan</h2>
                <p>{plan.length} days total</p>
                <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--muted-border-color)', padding: '1rem', marginBottom: '1rem', borderRadius: 'var(--border-radius)' }}>
                    {plan.slice(0, 5).map((day, i) => (
                        <div class="preview-item" key={i}>
                            <span class="preview-date">{day.date ? day.date.toLocaleDateString() : `Day ${i + 1}`}</span>
                            <span>{day.chapters.map(formatChapter).join(', ')}</span>
                        </div>
                    ))}

                    {plan.length > 10 ? (
                        <>
                            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--muted-color)', borderBottom: '1px solid var(--muted-border-color)' }}>
                                ... {plan.length - 10} days omitted ...
                            </div>
                            {plan.slice(-5).map((day, i) => (
                                <div class="preview-item" key={`end-${i}`}>
                                    <span class="preview-date">{day.date ? day.date.toLocaleDateString() : `Day ${plan.length - 4 + i}`}</span>
                                    <span>{day.chapters.map(formatChapter).join(', ')}</span>
                                </div>
                            ))}
                        </>
                    ) : plan.slice(5).map((day, i) => (
                        <div class="preview-item" key={`mid-${i}`}>
                            <span class="preview-date">{day.date ? day.date.toLocaleDateString() : `Day ${6 + i}`}</span>
                            <span>{day.chapters.map(formatChapter).join(', ')}</span>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <button onClick={generateEpub} disabled={isGenerating || plan.length === 0}>
                            {isGenerating ? 'Generating...' : 'Download EPUB'}
                        </button>
                        <button onClick={generateAudiobook} disabled={isGenerating || plan.length === 0 || bibleVersion !== 'bsb' || planHasPartialChapters} class="secondary">
                            {isGenerating ? 'Generating...' : 'Generate Audiobook (BSB only)'}
                        </button>
                    </div>

                    {plan.length > 0 && (
                        <div style={{ background: 'var(--card-section-background-color)', padding: '1rem', borderRadius: 'var(--border-radius)', border: '1px solid var(--muted-border-color)' }}>
                            <p style={{ margin: 0 }}><strong>Audiobook Info:</strong></p>
                            <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.5rem', fontSize: '0.9rem' }}>
                                <li>Audio is only available for BSB (Berean Standard Bible).</li>
                                {planHasPartialChapters && (
                                    <li style={{ color: 'var(--secondary)' }}>This plan includes part-chapter readings, which the chapter based recordings cannot represent, so only EPUB generation is available.</li>
                                )}
                                <li>Estimated: {audioStats.downloadSizeMB}MB download, {audioStats.totalSizeMB}MB total on disk.</li>
                                <li>Requires a folder selection to save daily MP3 files.</li>
                                <li style={{ color: 'var(--secondary)' }}>Note: Audiobook generation is only supported in <strong>Chrome</strong> and <strong>Edge</strong>.</li>
                            </ul>
                        </div>
                    )}
                </div>
                {status && <p style={{ marginTop: '1rem' }}><small>{status}</small></p>}
            </section>
        </div>
    );
};

render(<App />, document.getElementById('app')!);
