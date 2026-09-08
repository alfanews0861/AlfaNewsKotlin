import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import * as admin from 'firebase-admin';

const mockAdd = jest.fn<any>();
const mockSet = jest.fn<any>();
const mockUpdate = jest.fn<any>();
const mockGet = jest.fn<any>();
const mockWhere = jest.fn<any>();
const mockLimit = jest.fn<any>();
const mockSend = jest.fn<any>();

jest.mock('firebase-admin', () => {
    return {
        firestore: Object.assign(jest.fn(() => ({
            collection: (colName: string) => ({
                doc: (docId: string) => ({
                    get: mockGet,
                    set: mockSet,
                    update: mockUpdate,
                    collection: (subCol: string) => ({
                        add: mockAdd
                    })
                }),
                where: mockWhere
            })
        })), {
            FieldValue: {
                serverTimestamp: jest.fn(() => 'MOCK_TIMESTAMP'),
                increment: jest.fn((n) => `INCREMENT_${n}`),
                delete: jest.fn(() => 'MOCK_DELETE'),
                arrayRemove: jest.fn((val) => `REMOVE_${val}`)
            }
        }),
        messaging: jest.fn(() => ({
            send: mockSend
        }))
    };
});

import { notifyReporter } from './reporter_handler';

describe('notifyReporter Notification & Desk Chat Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('DUPLICATE rejection: Should post Desk Chat message and send FCM push', async () => {
        const mockReporterId = 'rep_12345';
        const mockUserData = {
            name: 'Ravi Reporter',
            fcmToken: 'mock_token_abc',
            notificationsEnabled: true
        };

        mockGet.mockResolvedValueOnce({
            exists: true,
            id: mockReporterId,
            data: () => mockUserData
        } as any);

        mockAdd.mockResolvedValueOnce({ id: 'msg_999' } as any);
        mockSet.mockResolvedValueOnce({} as any);
        mockSend.mockResolvedValueOnce('fcm_success' as never);

        await notifyReporter(
            mockReporterId,
            'post_dup_1',
            'ఎస్పీని కలిసిన ట్రాఫిక్ సీఐ',
            'DUPLICATE',
            '',
            'ఈ మండలంలో గత 6 గంటల్లో ఇప్పటికే ప్రచురించబడిన వార్త (డూప్లికేట్).'
        );

        // 1. In-App Desk Chat Message Verification
        expect(mockAdd).toHaveBeenCalledTimes(1);
        const addedMsg = mockAdd.mock.calls[0][0] as any;
        expect(addedMsg.senderName).toBe('ఆల్ఫా న్యూస్ ఎడిటోరియల్ డెస్క్');
        expect(addedMsg.senderRole).toBe('ADMIN');
        expect(addedMsg.type).toBe('WARNING');
        expect(addedMsg.text).toContain('నమస్కారం Ravi Reporter గారు');
        expect(addedMsg.text).toContain('ఎస్పీని కలిసిన ట్రాఫిక్ సీఐ');
        expect(addedMsg.text).toContain('ఎడిటోరియల్ డెస్క్ పరిశీలన');

        // 2. Unread Count Increment for Reporter
        expect(mockSet).toHaveBeenCalledTimes(1);
        const convSummary = mockSet.mock.calls[0][0] as any;
        expect(convSummary.reporterId).toBe(mockReporterId);
        expect(convSummary.reporterName).toBe('Ravi Reporter');
        expect(convSummary.unreadCountForReporter).toBe('INCREMENT_1');

        // 3. FCM Push Notification
        expect(mockSend).toHaveBeenCalledTimes(1);
        const fcmPayload = mockSend.mock.calls[0][0] as any;
        expect(fcmPayload.token).toBe('mock_token_abc');
        expect(fcmPayload.notification.title).toContain('ఎడిటోరియల్ డెస్క్');
    });

    test('INTERNAL_ERROR failure: Should sanitize technical error and post respectful message', async () => {
        const mockReporterId = 'rep_99999';
        const mockUserData = {
            name: 'Venkey Reporter',
            notificationsEnabled: true
        };

        mockGet.mockResolvedValueOnce({
            exists: true,
            id: mockReporterId,
            data: () => mockUserData
        } as any);

        mockAdd.mockResolvedValueOnce({ id: 'msg_fail_1' } as any);
        mockSet.mockResolvedValueOnce({} as any);

        await notifyReporter(
            mockReporterId,
            'post_fail_1',
            'పొదలకూరు ఆలయంలో పూజలు',
            'INTERNAL_ERROR',
            '',
            'వీడియో అప్‌లోడ్ విఫలమైంది (YouTube Quota Exceeded)'
        );

        expect(mockAdd).toHaveBeenCalledTimes(1);
        const addedMsg = mockAdd.mock.calls[0][0] as any;
        expect(addedMsg.senderName).toBe('ఆల్ఫా న్యూస్ ఎడిటోరియల్ డెస్క్');
        expect(addedMsg.text).toContain('నమస్కారం Venkey Reporter గారు');
        expect(addedMsg.text).toContain('వీడియో ఫైల్ ప్రాసెసింగ్ సమయంలో సాంకేతిక అంతరాయం ఏర్పడింది');
        expect(addedMsg.text).not.toContain('Quota');
        expect(addedMsg.text).not.toContain('YouTube');

        expect(mockSet).toHaveBeenCalledTimes(1);
    });

    test('Name fallback: Should find user by name if ID was passed as reporter name', async () => {
        const mockReporterName = 'Gangadhar Reporter';
        const mockResolvedUserId = 'actual_uid_777';

        // 1st get: doc('Gangadhar Reporter').get() -> does not exist
        mockGet.mockResolvedValueOnce({ exists: false } as any);

        // where('name', '==', 'Gangadhar Reporter').limit(1).get()
        mockWhere.mockReturnValueOnce({
            limit: () => ({
                get: jest.fn<any>().mockResolvedValueOnce({
                    empty: false,
                    docs: [{
                        id: mockResolvedUserId,
                        exists: true,
                        data: () => ({ name: mockReporterName, notificationsEnabled: true })
                    }]
                } as any)
            })
        } as any);

        mockAdd.mockResolvedValueOnce({ id: 'msg_name_lookup' } as any);
        mockSet.mockResolvedValueOnce({} as any);

        await notifyReporter(
            mockReporterName,
            'post_jannaram',
            'జన్నారంలో ఓటర్ల విచారణ',
            'POLICY_VIOLATION',
            '',
            'నిబంధనల ఉల్లంఘన'
        );

        expect(mockAdd).toHaveBeenCalledTimes(1);
        const convSummary = mockSet.mock.calls[0][0] as any;
        expect(convSummary.reporterId).toBe(mockResolvedUserId);
    });
});
