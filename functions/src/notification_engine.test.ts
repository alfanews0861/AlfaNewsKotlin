import * as admin from 'firebase-admin';

// Mock firebase-admin
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
        const topNews = {
            id: 'news123',
            headline: { telugu: 'Telugu Headline' },
            mediaUrl: 'http://image.jpg'
        };
        const title = '🌟 తాజా ముఖ్య వార్తలు (AlfaNews)';
        const body = topNews.headline.telugu;
        const imageUrl = topNews.mediaUrl;

        const message = {
            notification: {
                title: title,
                body: body
            },
            android: {
                notification: {
                    imageUrl: imageUrl,
                    priority: 'high',
                    channelId: 'general_news'
                }
            },
            data: {
                actionUrl: `alfanews://news/${topNews.id}`,
                newsId: topNews.id,
                channelId: "general_news",
                imageUrl: imageUrl,
                title: title,
                body: body
            },
            topic: 'all_users'
        };

        expect(message.android.notification.imageUrl).toBe(imageUrl);
        expect(message.android.notification.priority).toBe('high');
        expect(message.data.actionUrl).toContain(topNews.id);
    });
});
