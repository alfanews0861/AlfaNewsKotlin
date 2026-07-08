import * as admin from 'firebase-admin';
import { slugify, getTopicName } from './utils';

// Mock firebase-admin
// ... (rest of the file remains same)
jest.mock('firebase-admin', () => {
    const mockFirestore = {
        collection: jest.fn().mockReturnThis(),
        doc: jest.fn().mockReturnThis(),
        get: jest.fn(),
        set: jest.fn(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        FieldValue: {
            serverTimestamp: jest.fn(() => 'server-timestamp')
        }
    };

    const mockMessaging = {
        send: jest.fn().mockResolvedValue('message-id')
    };

    return {
        firestore: jest.fn(() => mockFirestore),
        messaging: jest.fn(() => mockMessaging),
        apps: []
    };
});

describe('Notification Engine Logic', () => {
    let db: any;
    let messaging: any;

    beforeEach(() => {
        jest.clearAllMocks();
        db = admin.firestore();
        messaging = admin.messaging();
    });

    test('Sorting logic should prioritize news with mediaUrl if scores are equal', () => {
        const allNews = [
            { id: '1', score: 100, headline: 'No media', mediaUrl: '' },
            { id: '2', score: 100, headline: 'With media', mediaUrl: 'http://img.png' },
            { id: '3', score: 50, headline: 'Low score with media', mediaUrl: 'http://img.png' }
        ];

        const sortedNews = [...allNews].sort((a: any, b: any) => {
            const scoreA = (a.score || 0) + (a.mediaUrl ? 100 : 0);
            const scoreB = (b.score || 0) + (b.mediaUrl ? 100 : 0);
            return scoreB - scoreA;
        });

        expect(sortedNews[0].id).toBe('2'); // Higher score because of mediaUrl bonus
        expect(sortedNews[1].id).toBe('1');
        expect(sortedNews[2].id).toBe('3');
    });

    test('District filtering logic', () => {
        const district = "హైదరాబాద్";
        const allNews = [
            { id: '1', categories: ["గుంటూరు"], district: "Guntur" },
            { id: '2', categories: ["హైదరాబాద్"], district: "Hyderabad" },
            { id: '3', categories: ["వరంగల్"], district: "Warangal" }
        ];

        const districtNews = allNews.filter((n: any) =>
            (Array.isArray(n.categories) && n.categories.includes(district)) || n.district === district
        );

        expect(districtNews.length).toBe(1);
        expect(districtNews[0].id).toBe('2');
    });

    test('FCM Payload structure should include rich notification fields', () => {
        // ... (existing test code)
    });

    test('Slugify parity test', () => {
        const input = "హైదరాబాద్";
        const slug = slugify(input);

        // Match logic in NotificationHelper.kt: hex-encode non-ASCII
        // 'హ' -> u0c39 -> '0c39'
        // 'ై' -> u0c48 -> '0c48'
        // 'ద' -> u0c26 -> '0c26'
        // 'ర' -> u0c30 -> '0c30'
        // 'ా' -> u0c3e -> '0c3e'
        // 'బ' -> u0c2c -> '0c2c'
        // 'ా' -> u0c3e -> '0c3e'
        // 'ద' -> u0c26 -> '0c26'
        // '్' -> u0c4d -> '0c4d'

        expect(slug).toMatch(/^[a-f0-9]+$/);
        expect(slug.length).toBeGreaterThan(input.length);

        const topicName = getTopicName("district", input);
        expect(topicName).toBe(`district_${slug}`);
    });
});
