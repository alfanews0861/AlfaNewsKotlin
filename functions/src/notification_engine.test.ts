import * as admin from 'firebase-admin';
import { slugify, getTopicName, detectTopTeluguLeader } from './utils';
import {
    buildNewsMessage,
    calculateTrendingScore,
    dispatchBreakingNotification,
    evaluateBreakingGate,
    getCanonicalDistrict,
    getEdgeProxiedImageUrl,
    getEngagementViews,
    getNormalizedQualityScore,
    isMainNews,
    isPauseActive,
    isStatewideOrBroadBreaking,
} from './notification_engine';

jest.mock('firebase-admin', () => {
    const mockTransaction = {
        get: jest.fn(),
        set: jest.fn(),
    };
    const mockFirestore: any = {
        collection: jest.fn().mockReturnThis(),
        doc: jest.fn().mockReturnThis(),
        get: jest.fn(),
        set: jest.fn().mockResolvedValue(undefined),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        runTransaction: jest.fn(async (cb: any) => cb(mockTransaction)),
        __mockTransaction: mockTransaction,
    };

    const mockMessaging = {
        send: jest.fn().mockResolvedValue('message-id')
    };

    const firestoreFn: any = jest.fn(() => mockFirestore);
    firestoreFn.FieldValue = {
        serverTimestamp: jest.fn(() => 'server-timestamp')
    };

    return {
        firestore: firestoreFn,
        messaging: jest.fn(() => mockMessaging),
        apps: []
    };
});

describe('Notification Engine — Quality, Hybrid FCM & Gate Pipeline', () => {
    let db: any;
    let messaging: any;

    beforeEach(() => {
        jest.clearAllMocks();
        db = admin.firestore();
        messaging = admin.messaging();
    });

    test('getNormalizedQualityScore normalizes 0-10 qualityScore, legacy 0-100 score, and qualitySignals', () => {
        expect(getNormalizedQualityScore({ qualityScore: 9.2 })).toBeCloseTo(92);
        expect(getNormalizedQualityScore({ score: 85 })).toBe(85);
        expect(getNormalizedQualityScore({ qualityScore: 8.0, score: 40 })).toBe(80);
        expect(getNormalizedQualityScore({ qualitySignals: { publicInterestScore: 0.8, investigativeScore: 0.5 } })).toBeCloseTo(78);
        expect(getNormalizedQualityScore({})).toBe(50);
    });

    test('getEngagementViews reads max across longViews, views, and viewCount', () => {
        expect(getEngagementViews({ longViews: 12, views: 5, viewCount: 240 })).toBe(240);
        expect(getEngagementViews({ longViews: 95 })).toBe(95);
        expect(getEngagementViews({})).toBe(0);
    });

    test('calculateTrendingScore ensures a 3h-old high-quality story decisively beats 5m-old low-quality filler', () => {
        const now = Date.now();
        const majorStory = {
            id: 'major',
            qualityScore: 9.2,
            viewCount: 120,
            mediaUrl: 'https://cdn.example.com/major.jpg',
            timestamp: now - 3 * 60 * 60 * 1000,
        };
        const lowQualityFiller = {
            id: 'filler',
            qualityScore: 2.0,
            viewCount: 0,
            mediaUrl: 'https://cdn.example.com/filler.jpg',
            timestamp: now - 5 * 60 * 1000,
        };

        const majorScore = calculateTrendingScore(majorStory, now);
        const fillerScore = calculateTrendingScore(lowQualityFiller, now);

        expect(majorScore).toBeGreaterThan(fillerScore * 2.5);
    });

    test('getEdgeProxiedImageUrl proxies Firebase Storage URLs through wsrv.nl and preserves external CDNs', () => {
        const fbUrl = 'https://firebasestorage.googleapis.com/v0/b/alfa.appspot.com/o/news%2Fpic.jpg?alt=media';
        const proxied = getEdgeProxiedImageUrl(fbUrl);
        expect(proxied).toContain('https://wsrv.nl/?url=');
        expect(proxied).toContain('output=webp');

        const extUrl = 'https://cdn.eenadu.net/news/img123.jpg';
        expect(getEdgeProxiedImageUrl(extUrl)).toBe(extUrl);
        expect(getEdgeProxiedImageUrl('')).toBeUndefined();
    });

    test('buildNewsMessage constructs a Hybrid FCM payload with Android tray, WebPush, wsrv.nl proxy, and canonical district', () => {
        const fbUrl = 'https://firebasestorage.googleapis.com/v0/b/alfa.appspot.com/o/pic.jpg?alt=media';
        const msg: any = buildNewsMessage(
            {
                id: 'news_123',
                headline: { telugu: 'విజయవాడలో భారీ వర్ష సూచన' },
                district: 'విజయవాడ',
            },
            '📍 ఎన్టీఆర్: భారీ వర్ష సూచన',
            'local_news_v2',
            fbUrl,
            4 * 60 * 60 * 1000,
            { topic: 'district_ntr' }
        );

        // Hybrid top-level notification
        expect(msg.notification.title).toContain('ఎన్టీఆర్');
        expect(msg.notification.imageUrl).toContain('https://wsrv.nl/?url=');

        // Android system tray notification for OEM reliability (Xiaomi/Vivo/Oppo)
        expect(msg.android.priority).toBe('high');
        expect(msg.android.notification.channelId).toBe('local_news_v2');
        expect(msg.android.notification.tag).toBe('alfa_local_district_ntr');
        expect(msg.android.notification.imageUrl).toContain('https://wsrv.nl/?url=');

        // WebPush payload
        expect(msg.webpush.notification.icon).toBe('https://alfanews.app/app_icon.png');
        expect(msg.webpush.notification.image).toContain('https://wsrv.nl/?url=');
        expect(msg.webpush.fcmOptions.link).toBe('https://alfanews.app/news/news_123');

        // Canonical district in data payload prevents Android self-unsubscribe bug
        expect(msg.data.district).toBe('ఎన్టీఆర్');
        expect(msg.data.rawDistrict).toBe('విజయవాడ');
        expect(msg.data.newsId).toBe('news_123');
        expect(msg.data.actionUrl).toBe('alfanews://news/news_123');
        expect(msg.data.newsType).toBe('DISTRICT');
    });

    test('Quiet Hours and Duplicates block breaking alerts WITHOUT touching daily quota transaction', async () => {
        const now = Date.now();
        const breakingStory = {
            headline: { telugu: 'రాష్ట్రవ్యాప్తంగా కీలక నిర్ణయం' },
            category: 'రాజకీయం',
            district: 'ఆంధ్రప్రదేశ్',
            isBreaking: true,
            qualityScore: 8.8,
            storyFingerprint: 'ap_policy_2026',
            timestamp: now - 10 * 60 * 1000,
        };

        // 1. Quiet hours (2 AM IST) must reject BEFORE quota
        const quietResult = evaluateBreakingGate({
            postId: 'p1',
            after: breakingStory,
            settingsData: { breakingNotificationsEnabled: true },
            nowMs: now,
            istHour: 2,
        });
        expect(quietResult.allowed).toBe(false);
        expect(quietResult.reason).toBe('quiet_hours');

        // 2. Duplicate storyFingerprint must reject BEFORE quota
        const dupResult = evaluateBreakingGate({
            postId: 'p2',
            after: breakingStory,
            settingsData: {
                breakingNotificationsEnabled: true,
                recentFingerprints: ['ap_policy_2026'],
            },
            nowMs: now,
            istHour: 11,
        });
        expect(dupResult.allowed).toBe(false);
        expect(dupResult.reason).toBe('duplicate_or_fingerprint');

        // 3. Full dispatchBreakingNotification with duplicate ID must NOT invoke runTransaction (quota)
        db.get.mockResolvedValueOnce({
            exists: true,
            data: () => ({
                breakingNotificationsEnabled: true,
                recentGeneralIds: ['p_already_sent'],
            }),
        });
        const sent = await dispatchBreakingNotification('p_already_sent', breakingStory);
        expect(sent).toBe(false);
        expect(db.runTransaction).not.toHaveBeenCalled();
        expect(messaging.send).not.toHaveBeenCalled();
    });

    test('Per-district breaking cooldown does NOT block statewide breaking or another district', () => {
        const now = Date.now();
        const tenMinAgo = now - 10 * 60 * 1000;
        const ntrSlug = slugify('ఎన్టీఆర్');
        const gunturSlug = slugify('గుంటూరు');

        const settingsData = {
            breakingNotificationsEnabled: true,
            lastDistrictBreakingAt: {
                [ntrSlug]: tenMinAgo,
            },
        };

        // Same district (NTR / విజయవాడ) within 30m -> blocked
        const ntrBreaking = evaluateBreakingGate({
            postId: 'ntr_1',
            after: {
                headline: { telugu: 'విజయవాడలో భారీ అగ్నిప్రమాదం' },
                category: 'జిల్లా వార్త',
                district: 'విజయవాడ',
                isBreaking: true,
                qualityScore: 8.5,
                timestamp: now - 5 * 60 * 1000,
            },
            settingsData,
            nowMs: now,
            istHour: 14,
        });
        expect(ntrBreaking.allowed).toBe(false);
        expect(ntrBreaking.reason).toBe('district_cooldown_active');
        expect(ntrBreaking.maxLimit).toBe(3);

        // Different district (Guntur) -> allowed!
        const gunturBreaking = evaluateBreakingGate({
            postId: 'gnt_1',
            after: {
                headline: { telugu: 'గుంటూరులో రహదారి మూసివేత' },
                category: 'జిల్లా వార్త',
                district: 'గుంటూరు',
                isBreaking: true,
                qualityScore: 8.5,
                timestamp: now - 5 * 60 * 1000,
            },
            settingsData,
            nowMs: now,
            istHour: 14,
        });
        expect(gunturBreaking.allowed).toBe(true);
        expect(gunturBreaking.targetTopic).toBe(`district_${gunturSlug}`);
        expect(gunturBreaking.maxLimit).toBe(3);

        // Statewide breaking -> NOT blocked by NTR's district cooldown!
        const stateBreaking = evaluateBreakingGate({
            postId: 'state_1',
            after: {
                headline: { telugu: 'ఏపీ బడ్జెట్ కీలక ప్రకటన' },
                category: 'రాజకీయం',
                district: 'ఆంధ్రప్రదేశ్',
                isBreaking: true,
                qualityScore: 9.0,
                timestamp: now - 5 * 60 * 1000,
            },
            settingsData,
            nowMs: now,
            istHour: 14,
        });
        expect(stateBreaking.allowed).toBe(true);
        expect(stateBreaking.targetTopic).toBe('all_users');
        expect(stateBreaking.maxLimit).toBe(6);
    });

    test('Auto-expiring pause window allows notifications once pauseUntil has elapsed', () => {
        const now = Date.now();
        expect(isPauseActive(now + 60_000, now)).toBe(true);
        expect(isPauseActive(now - 60_000, now)).toBe(false);
        expect(isPauseActive(0, now)).toBe(false);
    });

    test('detectTopTeluguLeader ignores casual headline mentions & greetings, but triggers on genuine statements', () => {
        // Casual mention without statement/action -> false
        const casual = detectTopTeluguLeader('చంద్రబాబు పర్యటన ఫోటోలు వైరల్', 'గ్రామంలో అభిమానుల సందడి నెలకొంది.');
        expect(casual.isTopLeaderNews).toBe(false);

        // Routine greeting -> false
        const greeting = detectTopTeluguLeader('రేవంత్ రెడ్డి పుట్టినరోజు శుభాకాంక్షలు తెలిపారు', 'అభిమానులకు ధన్యవాదాలు అన్నారు.');
        expect(greeting.isTopLeaderNews).toBe(false);

        // Genuine policy statement -> true
        const statement = detectTopTeluguLeader('రైతు భరోసాపై సీఎం రేవంత్ రెడ్డి కీలక ప్రకటన', 'త్వరలోనే నిధులు విడుదల చేస్తామని స్పష్టం చేశారు.');
        expect(statement.isTopLeaderNews).toBe(true);
    });

    test('Canonical district mapping & slugify parity', () => {
        expect(getCanonicalDistrict('విజయవాడ')).toBe('ఎన్టీఆర్');
        expect(getCanonicalDistrict('Nellore')).toBe('శ్రీ పొట్టి శ్రీరాములు నెల్లూరు');

        const slug = slugify('హైదరాబాద్');
        expect(slug).toMatch(/^[a-f0-9]+$/);
        expect(getTopicName('district', 'హైదరాబాద్')).toBe(`district_${slug}`);
    });

    test('isMainNews and isStatewideOrBroadBreaking protect all_users from local district news leaks', () => {
        const localNews = { id: 'loc1', category: 'జిల్లా వార్త', district: 'వరంగల్', qualityScore: 8.5 };
        const stateNews = { id: 'main1', category: 'జాతీయం', district: 'National', qualityScore: 8.2 };

        expect(isMainNews(localNews)).toBe(false);
        expect(isMainNews(stateNews)).toBe(true);
        expect(isStatewideOrBroadBreaking(localNews)).toBe(false);
        expect(isStatewideOrBroadBreaking(stateNews)).toBe(true);
    });
});
