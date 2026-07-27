import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { bibleData as BIBLE_BOOKS } from '../src/bibleData.ts';
import {
    assignDates,
    buildChapterList,
    buildGroupDays,
    buildScheduledDays,
    filterChapterHtml,
    formatChapter,
    hasPartialChapters,
    parseReference
} from '../src/planLogic.ts';
import type { ReadingGroup } from '../src/planLogic.ts';
import { HORNER_GROUPS, PRESET_PLANS, getPresetPlan } from '../src/presetPlans.ts';
import { MCHEYNE_SCHEDULE } from '../src/mcheynePlan.ts';

const chapterHtml = readFileSync(
    new URL('../bsb_unzipped/bsb - final - 7-18-21/OEBPS/Text/1.htm', import.meta.url),
    'utf8'
);

test('buildChapterList expands books in canonical order', () => {
    const chapters = buildChapterList(['Jude', 'Obadiah']);
    assert.deepEqual(chapters, [
        { book: 'Obadiah', chapter: 1, file: 889 },
        { book: 'Jude', chapter: 1, file: 1167 }
    ]);
});

test('parseReference handles single chapters, ranges and verse ranges', () => {
    assert.deepEqual(parseReference('Genesis 1'), [{ book: 'Genesis', chapter: 1, file: 1 }]);
    assert.deepEqual(parseReference('Genesis 9-10'), [
        { book: 'Genesis', chapter: 9, file: 9 },
        { book: 'Genesis', chapter: 10, file: 10 }
    ]);
    assert.deepEqual(parseReference('Psalm 119:1-24'), [
        { book: 'Psalms', chapter: 119, file: 597, startVerse: 1, endVerse: 24 }
    ]);
    assert.deepEqual(parseReference('1 Thes 5'), [{ book: '1 Thessalonians', chapter: 5, file: 1116 }]);
    assert.deepEqual(parseReference('SongOfSongs 2'), [{ book: 'Songs', chapter: 2, file: 673 }]);
});

test('parseReference rejects invalid references', () => {
    assert.throws(() => parseReference('Hezekiah 1'), /Unknown book/);
    assert.throws(() => parseReference('Jude 2'), /Chapter out of range/);
    assert.throws(() => parseReference('Genesis'), /Unable to parse/);
});

test('formatChapter includes verse ranges only for partial chapters', () => {
    assert.equal(formatChapter({ book: 'Psalms', chapter: 119, file: 597 }), 'Psalms 119');
    assert.equal(
        formatChapter({ book: 'Psalms', chapter: 119, file: 597, startVerse: 1, endVerse: 24 }),
        'Psalms 119:1-24'
    );
});

test('buildGroupDays takes the configured chapters from each group every day', () => {
    const groups: ReadingGroup[] = [
        { id: 1, name: 'Law', books: ['Genesis'], chaptersPerDay: 2, repeat: false },
        { id: 2, name: 'Gospel', books: ['Mark'], chaptersPerDay: 1, repeat: false }
    ];
    const days = buildGroupDays(groups);

    // Genesis (50 chapters, 2/day) is the longest group at 25 days.
    assert.equal(days.length, 25);
    assert.deepEqual(days[0].map(formatChapter), ['Genesis 1', 'Genesis 2', 'Mark 1']);
    // Mark only has 16 chapters, so it drops off once finished.
    assert.deepEqual(days[16].map(formatChapter), ['Genesis 33', 'Genesis 34']);
    const allGenesis = days.flat().filter(chapter => chapter.book === 'Genesis');
    assert.equal(allGenesis.length, 50);
});

test('buildGroupDays repeats groups that are marked as repeating', () => {
    const groups: ReadingGroup[] = [
        { id: 1, name: 'Law', books: ['Genesis'], chaptersPerDay: 1, repeat: false },
        { id: 2, name: 'Short', books: ['Jude'], chaptersPerDay: 1, repeat: true }
    ];
    const days = buildGroupDays(groups);
    assert.equal(days.length, 50);
    assert.deepEqual(days[49].map(formatChapter), ['Genesis 50', 'Jude 1']);
});

test('buildGroupDays uses the requested number of days when every group repeats', () => {
    const days = buildGroupDays(HORNER_GROUPS, 365);
    assert.equal(days.length, 365);
    assert.deepEqual(days[0].map(formatChapter), [
        'Matthew 1', 'Genesis 1', 'Romans 1', '1 Thessalonians 1', 'Job 1',
        'Psalms 1', 'Proverbs 1', 'Joshua 1', 'Isaiah 1', 'Acts 1'
    ]);
    // Acts (28 chapters) and Proverbs (31 chapters) restart once finished.
    assert.equal(days[28].map(formatChapter).at(-1), 'Acts 1');
    assert.equal(days[31].map(formatChapter)[6], 'Proverbs 1');
    days.forEach(day => assert.equal(day.length, 10));
});

test('buildGroupDays ignores empty groups and groups without chapters per day', () => {
    const days = buildGroupDays([
        { id: 1, name: 'Empty', books: [], chaptersPerDay: 3, repeat: false },
        { id: 2, name: 'Disabled', books: ['Genesis'], chaptersPerDay: 0, repeat: false },
        { id: 3, name: 'Gospel', books: ['Jude'], chaptersPerDay: 1, repeat: false }
    ]);
    assert.deepEqual(days, [[{ book: 'Jude', chapter: 1, file: 1167 }]]);
    assert.deepEqual(buildGroupDays([]), []);
});

test('assignDates only schedules readings on the selected week days', () => {
    const days = [
        [{ book: 'Genesis', chapter: 1, file: 1 }],
        [{ book: 'Genesis', chapter: 2, file: 2 }]
    ];
    // 2024-01-01 is a Monday.
    const dated = assignDates(days, { useDates: true, startDate: '2024-01-01', readingDays: [1] });
    assert.equal(dated.length, 2);
    assert.equal(dated[0].date?.toISOString().slice(0, 10), '2024-01-01');
    assert.equal(dated[1].date?.toISOString().slice(0, 10), '2024-01-08');

    const undated = assignDates(days, { useDates: false, startDate: '2024-01-01', readingDays: [] });
    assert.deepEqual(undated.map(day => day.date), [null, null]);
});

test("the M'Cheyne schedule is a valid full year plan", () => {
    assert.equal(MCHEYNE_SCHEDULE.length, 365);
    const days = buildScheduledDays(MCHEYNE_SCHEDULE);
    days.forEach(day => assert.ok(day.length >= 4));

    assert.deepEqual(days[0].map(formatChapter), ['Genesis 1', 'Matthew 1', 'Ezra 1', 'Acts 1']);
    assert.deepEqual(days[364].map(formatChapter), ['2 Chronicles 36', 'Revelation 22', 'Malachi 4', 'Psalms 150']);

    // Every Old Testament chapter outside of Psalms is covered exactly once.
    const otBooks = BIBLE_BOOKS.slice(0, 39).filter(book => book.name !== 'Psalms');
    const readFiles = days.flat().map(chapter => chapter.file);
    const readCounts = new Map<number, number>();
    readFiles.forEach(file => readCounts.set(file, (readCounts.get(file) ?? 0) + 1));
    otBooks.forEach(book => {
        for (let chapter = 1; chapter <= book.chapters; chapter++) {
            assert.equal(
                readCounts.get(book.startFile + chapter - 1) ?? 0,
                1,
                `${book.name} ${chapter} should be read once`
            );
        }
    });
});

test("the M'Cheyne plan contains partial chapters, Horner does not", () => {
    const mcheyne = assignDates(buildScheduledDays(MCHEYNE_SCHEDULE), {
        useDates: false,
        startDate: '2024-01-01',
        readingDays: []
    });
    assert.equal(hasPartialChapters(mcheyne), true);

    const horner = assignDates(buildGroupDays(HORNER_GROUPS, 30), {
        useDates: false,
        startDate: '2024-01-01',
        readingDays: []
    });
    assert.equal(hasPartialChapters(horner), false);
});

test('preset plans are well formed', () => {
    assert.deepEqual(PRESET_PLANS.map(plan => plan.id), ['horner', 'mcheyne']);
    assert.equal(getPresetPlan('horner').groups?.length, 10);
    assert.ok(getPresetPlan('mcheyne').schedule);
    assert.throws(() => getPresetPlan('nope' as 'horner'), /Unknown preset plan/);

    // Horner's ten lists cover the whole Bible exactly once.
    const hornerBooks = HORNER_GROUPS.flatMap(group => group.books);
    assert.equal(hornerBooks.length, new Set(hornerBooks).size);
    assert.deepEqual([...hornerBooks].sort(), BIBLE_BOOKS.map(book => book.name).sort());
});

test('filterChapterHtml returns the html untouched for whole chapters', () => {
    assert.equal(filterChapterHtml(chapterHtml), chapterHtml);
});

test('filterChapterHtml keeps only the requested verses', () => {
    const filtered = filterChapterHtml(chapterHtml, 3, 5);

    assert.ok(filtered.includes('Let there be light'));
    assert.ok(filtered.includes('the first day'), 'trailing text of verse 5 is kept');
    assert.ok(!filtered.includes('In the beginning God created'), 'verse 1 is dropped');
    assert.ok(!filtered.includes('Let there be an expanse'), 'verse 6 is dropped');

    // Headings are kept when they introduce a kept verse, and dropped otherwise.
    assert.ok(filtered.includes('The First Day'));
    assert.ok(!filtered.includes('The Second Day'));
    assert.ok(!filtered.includes('The Creation'));

    // Verse numbers of the kept verses survive, others do not.
    const verses = [...filtered.matchAll(/<span[^>]*class="reftext"[^>]*>(\d+)<\/span>/g)].map(match => match[1]);
    assert.deepEqual(verses, ['3', '4', '5']);

    // The markup stays balanced.
    assert.equal((filtered.match(/<p\b/g) || []).length, (filtered.match(/<\/p>/g) || []).length);
});

test('filterChapterHtml supports open ended ranges', () => {
    const fromStart = filterChapterHtml(chapterHtml, undefined, 2);
    assert.ok(fromStart.includes('In the beginning God created'));
    assert.ok(!fromStart.includes('Let there be light'));

    const toEnd = filterChapterHtml(chapterHtml, 30);
    assert.ok(!toEnd.includes('In the beginning God created'));
    assert.ok(toEnd.includes('the sixth day'));
});
