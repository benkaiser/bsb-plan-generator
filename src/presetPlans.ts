import type { ReadingGroup } from './planLogic.ts';
import { MCHEYNE_SCHEDULE } from './mcheynePlan.ts';

export type PresetPlanId = 'horner' | 'mcheyne';

export interface PresetPlan {
    id: PresetPlanId;
    name: string;
    description: string;
    /** Group based plans cycle their lists, one chapter a day from each list. */
    groups?: ReadingGroup[];
    /** Fixed plans have an explicit reading list for every day. */
    schedule?: string[][];
    defaultDays?: number;
}

export const HORNER_GROUPS: ReadingGroup[] = [
    { id: 1, name: 'Gospels', chaptersPerDay: 1, repeat: true, books: ['Matthew', 'Mark', 'Luke', 'John'] },
    { id: 2, name: 'Pentateuch', chaptersPerDay: 1, repeat: true, books: ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'] },
    { id: 3, name: 'Epistles I', chaptersPerDay: 1, repeat: true, books: ['Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', 'Hebrews'] },
    { id: 4, name: 'Epistles II', chaptersPerDay: 1, repeat: true, books: ['1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'] },
    { id: 5, name: 'Wisdom', chaptersPerDay: 1, repeat: true, books: ['Job', 'Ecclesiastes', 'Songs'] },
    { id: 6, name: 'Psalms', chaptersPerDay: 1, repeat: true, books: ['Psalms'] },
    { id: 7, name: 'Proverbs', chaptersPerDay: 1, repeat: true, books: ['Proverbs'] },
    { id: 8, name: 'History', chaptersPerDay: 1, repeat: true, books: ['Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther'] },
    { id: 9, name: 'Prophets', chaptersPerDay: 1, repeat: true, books: ['Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi'] },
    { id: 10, name: 'Acts', chaptersPerDay: 1, repeat: true, books: ['Acts'] }
];

export const PRESET_PLANS: PresetPlan[] = [
    {
        id: 'horner',
        name: "Professor Horner's Bible Reading System",
        description: 'Ten lists read side by side, one chapter a day from each. Every list restarts as soon as it is finished, so the readings never line up the same way twice.',
        groups: HORNER_GROUPS,
        defaultDays: 365
    },
    {
        id: 'mcheyne',
        name: "M'Cheyne One Year Reading Plan",
        description: "Robert Murray M'Cheyne's classic plan: four readings a day (two family, two private) that cover the Old Testament once and the New Testament and Psalms twice in a year.",
        schedule: MCHEYNE_SCHEDULE
    }
];

export const getPresetPlan = (id: PresetPlanId): PresetPlan => {
    const plan = PRESET_PLANS.find(preset => preset.id === id);
    if (!plan) throw new Error(`Unknown preset plan: ${id}`);
    return plan;
};
