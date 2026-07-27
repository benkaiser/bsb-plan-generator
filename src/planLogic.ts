import { bibleData as BIBLE_BOOKS } from './bibleData.ts';
import type { BibleBook } from './bibleData.ts';

export interface Chapter {
    book: string;
    chapter: number;
    file: number;
    /** First verse of the reading, when only part of the chapter is read. */
    startVerse?: number;
    /** Last verse of the reading, when only part of the chapter is read. */
    endVerse?: number;
}

export interface Day {
    date: Date | null;
    chapters: Chapter[];
}

export interface ReadingGroup {
    id: number;
    name: string;
    books: string[];
    chaptersPerDay: number;
    /** Start the group again from the beginning once it has been finished. */
    repeat: boolean;
}

export interface DateOptions {
    useDates: boolean;
    startDate: string;
    readingDays: number[];
}

const MAX_DAYS = 5000;
/** Used when every group repeats forever (e.g. Professor Horner's plan). */
export const DEFAULT_CYCLE_DAYS = 365;

const bookByName = new Map<string, BibleBook>(BIBLE_BOOKS.map(b => [b.name, b]));

const normalizeBookKey = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '');

const bookByKey = new Map<string, BibleBook>(BIBLE_BOOKS.map(b => [normalizeBookKey(b.name), b]));

/** Alternative spellings used by well known plans, mapped to our book names. */
const BOOK_ALIASES: Record<string, string> = {
    psalm: 'Psalms',
    song: 'Songs',
    songofsongs: 'Songs',
    songofsolomon: 'Songs',
    canticles: 'Songs',
    ecclesiaste: 'Ecclesiastes',
    '1thes': '1 Thessalonians',
    '2thes': '2 Thessalonians',
    '1thess': '1 Thessalonians',
    '2thess': '2 Thessalonians',
    '1sam': '1 Samuel',
    '2sam': '2 Samuel',
    '1chron': '1 Chronicles',
    '2chron': '2 Chronicles',
    '1tim': '1 Timothy',
    '2tim': '2 Timothy',
    '1pet': '1 Peter',
    '2pet': '2 Peter'
};

export const findBook = (name: string): BibleBook | undefined => {
    const direct = bookByName.get(name);
    if (direct) return direct;
    const key = normalizeBookKey(name);
    const aliased = BOOK_ALIASES[key];
    if (aliased) return bookByName.get(aliased);
    return bookByKey.get(key);
};

export const chapterFile = (book: BibleBook, chapter: number): number => book.startFile + chapter - 1;

/** Expands the given book names (in canonical order) into a flat list of chapters. */
export const buildChapterList = (bookNames: string[]): Chapter[] => {
    const chapters: Chapter[] = [];
    BIBLE_BOOKS.forEach(book => {
        if (!bookNames.includes(book.name)) return;
        for (let i = 1; i <= book.chapters; i++) {
            chapters.push({ book: book.name, chapter: i, file: chapterFile(book, i) });
        }
    });
    return chapters;
};

/**
 * Parses a reading reference such as "Genesis 1", "Genesis 9-10" or "Psalm 119:1-24"
 * into the chapters it covers. Verse ranges are only supported for a single chapter.
 */
export const parseReference = (reference: string): Chapter[] => {
    const match = reference.trim().match(/^(.+?)\s*(\d+)(?:\s*[:.]\s*(\d+))?(?:\s*-\s*(\d+)(?:\s*[:.]\s*(\d+))?)?$/);
    if (!match) throw new Error(`Unable to parse reading reference: ${reference}`);

    const [, bookName, firstNumber, firstVerse, secondNumber, secondVerse] = match;
    const book = findBook(bookName);
    if (!book) throw new Error(`Unknown book in reading reference: ${reference}`);

    const startChapter = parseInt(firstNumber, 10);
    if (firstVerse) {
        // Verse range within a single chapter, e.g. "Psalm 119:1-24".
        const startVerse = parseInt(firstVerse, 10);
        const endVerse = secondVerse ? parseInt(secondVerse, 10) : (secondNumber ? parseInt(secondNumber, 10) : startVerse);
        const endChapter = secondVerse ? parseInt(secondNumber, 10) : startChapter;
        if (endChapter !== startChapter) throw new Error(`Verse ranges spanning chapters are not supported: ${reference}`);
        assertChapterExists(book, startChapter, reference);
        return [{ book: book.name, chapter: startChapter, file: chapterFile(book, startChapter), startVerse, endVerse }];
    }

    const endChapter = secondNumber ? parseInt(secondNumber, 10) : startChapter;
    if (endChapter < startChapter) throw new Error(`Invalid chapter range: ${reference}`);
    const chapters: Chapter[] = [];
    for (let chapter = startChapter; chapter <= endChapter; chapter++) {
        assertChapterExists(book, chapter, reference);
        chapters.push({ book: book.name, chapter, file: chapterFile(book, chapter) });
    }
    return chapters;
};

const assertChapterExists = (book: BibleBook, chapter: number, reference: string): void => {
    if (chapter < 1 || chapter > book.chapters) {
        throw new Error(`Chapter out of range for ${book.name}: ${reference}`);
    }
};

/** Turns a fixed schedule of reference strings (one entry per day) into daily chapter lists. */
export const buildScheduledDays = (schedule: string[][]): Chapter[][] =>
    schedule.map(day => day.flatMap(reference => parseReference(reference)));

/**
 * Builds the daily chapter lists for a set of reading groups, taking the configured
 * number of chapters per day from each group.
 */
export const buildGroupDays = (groups: ReadingGroup[], totalDays?: number): Chapter[][] => {
    const lists = groups
        .map(group => ({ group, chapters: buildChapterList(group.books), index: 0 }))
        .filter(list => list.chapters.length > 0 && list.group.chaptersPerDay > 0);
    if (lists.length === 0) return [];

    const finiteLengths = lists
        .filter(list => !list.group.repeat)
        .map(list => Math.ceil(list.chapters.length / list.group.chaptersPerDay));
    const naturalDays = finiteLengths.length > 0 ? Math.max(...finiteLengths) : DEFAULT_CYCLE_DAYS;
    const requestedDays = totalDays && totalDays > 0 ? totalDays : naturalDays;
    const dayCount = Math.min(requestedDays, MAX_DAYS);

    const days: Chapter[][] = [];
    for (let day = 0; day < dayCount; day++) {
        const dayChapters: Chapter[] = [];
        lists.forEach(list => {
            for (let i = 0; i < list.group.chaptersPerDay; i++) {
                if (list.index < list.chapters.length) {
                    dayChapters.push(list.chapters[list.index++]);
                } else if (list.group.repeat) {
                    dayChapters.push(list.chapters[list.index % list.chapters.length]);
                    list.index++;
                }
            }
        });
        if (dayChapters.length === 0) break;
        days.push(dayChapters);
    }
    return days;
};

/** Attaches dates to daily chapter lists, skipping days that are not reading days. */
export const assignDates = (days: Chapter[][], options: DateOptions): Day[] => {
    if (!options.useDates) return days.map(chapters => ({ date: null, chapters }));
    if (options.readingDays.length === 0) return [];

    const result: Day[] = [];
    const currentDate = new Date(options.startDate);
    let guard = 0;
    while (result.length < days.length && guard++ < MAX_DAYS * 8) {
        if (options.readingDays.includes(currentDate.getDay())) {
            result.push({ date: new Date(currentDate), chapters: days[result.length] });
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return result;
};

/** Formats a reading as it should be displayed, e.g. "Psalms 119:1-24". */
export const formatChapter = (chapter: Chapter): string => {
    const base = `${chapter.book} ${chapter.chapter}`;
    if (!chapter.startVerse && !chapter.endVerse) return base;
    const start = chapter.startVerse ?? 1;
    const end = chapter.endVerse;
    return end && end !== start ? `${base}:${start}-${end}` : `${base}:${start}`;
};

export const isPartialChapter = (chapter: Chapter): boolean =>
    chapter.startVerse !== undefined || chapter.endVerse !== undefined;

/** Audio is only available for whole chapters, so plans with verse ranges cannot be narrated. */
export const hasPartialChapters = (days: Day[]): boolean =>
    days.some(day => day.chapters.some(isPartialChapter));

const VERSE_MARKER = /<span[^>]*class="reftext"[^>]*>(\d+)<\/span>/gi;
const PARAGRAPH = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
const HEADING_CLASS = /class="[^"]*(hdg|cross)[^"]*"/i;

/**
 * Reduces a chapter's HTML down to the requested verse range, keeping the original
 * paragraph markup (and any section headings that introduce a kept verse).
 */
export const filterChapterHtml = (html: string, startVerse?: number, endVerse?: number): string => {
    if (startVerse === undefined && endVerse === undefined) return html;
    const start = startVerse ?? 1;
    const end = endVerse ?? Number.MAX_SAFE_INTEGER;

    let currentVerse = 0;
    let pendingHeadings = '';

    return html.replace(PARAGRAPH, (paragraph, attrs: string, inner: string) => {
        const markers = [...inner.matchAll(VERSE_MARKER)];

        if (markers.length === 0) {
            if (HEADING_CLASS.test(attrs) || inner.trim() === '') {
                // Headings belong to the verses that follow them.
                pendingHeadings += paragraph;
                return '';
            }
            // Continuation of the previous verse.
            return currentVerse >= start && currentVerse <= end ? paragraph : '';
        }

        const segments: { verse: number; text: string }[] = [];
        const leading = inner.slice(0, markers[0].index);
        if (leading.trim() !== '') segments.push({ verse: currentVerse, text: leading });
        markers.forEach((marker, i) => {
            const from = marker.index as number;
            const to = i + 1 < markers.length ? (markers[i + 1].index as number) : inner.length;
            segments.push({ verse: parseInt(marker[1], 10), text: inner.slice(from, to) });
        });
        currentVerse = parseInt(markers[markers.length - 1][1], 10);

        const kept = segments.filter(segment => segment.verse >= start && segment.verse <= end);
        const headings = pendingHeadings;
        pendingHeadings = '';
        if (kept.length === 0) return '';
        return `${headings}<p${attrs}>${kept.map(segment => segment.text).join('')}</p>`;
    });
};
