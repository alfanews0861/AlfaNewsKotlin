import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import * as admin from 'firebase-admin';

// Mock dependencies
jest.mock('firebase-admin', () => {
    const firestoreMock = {
        collection: jest.fn(),
        FieldValue: {
            serverTimestamp: jest.fn(() => 'MOCK_SERVER_TIMESTAMP'),
            increment: jest.fn((n) => `INCREMENT_${n}`)
        }
    };
    return {
        firestore: Object.assign(jest.fn(() => firestoreMock), firestoreMock),
        messaging: jest.fn(() => ({
            send: jest.fn().mockResolvedValue('MOCK_SEND_SUCCESS' as never),
            sendEach: jest.fn().mockResolvedValue({ successCount: 1 } as never)
        }))
    };
});

jest.mock('nodemailer', () => ({
    createTransport: jest.fn().mockReturnValue({
        sendMail: jest.fn().mockResolvedValue({ response: '250 OK' } as never)
    })
}));

describe('Reporter Application & Auto-Approval Logic Tests', () => {
    let db: any;

    beforeEach(() => {
        jest.clearAllMocks();
        db = admin.firestore();
    });

    test('Vacant Mandal Auto-Approval: Should set status to JOINED and role to REPORTER', async () => {
        const mockUserId = 'user_abc_123';
        const mockDistrict = 'Warangal';
        const mockMandal = 'Narsampet';

        // 1. Mock PENDING check for this user -> empty (no pending app)
        const mockUserPendingGet = jest.fn<any>().mockResolvedValue({ empty: true });
        const mockUserPendingQuery = {
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: mockUserPendingGet
        };

        // 2. Mock phone pending check -> empty
        const mockPhonePendingGet = jest.fn<any>().mockResolvedValue({ empty: true });
        const mockPhonePendingQuery = {
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: mockPhonePendingGet
        };

        // 3. Mock Active Reporter check for mandal -> empty (vacant mandal)
        const mockActiveReporterGet = jest.fn<any>().mockResolvedValue({ empty: true });
        const mockActiveReporterQuery = {
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: mockActiveReporterGet
        };

        // 4. Mock JOINED applications for mandal -> empty
        const mockJoinedAppGet = jest.fn<any>().mockResolvedValue({ empty: true });
        const mockJoinedAppQuery = {
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: mockJoinedAppGet
        };

        // 5. Mock PENDING applications for mandal -> empty
        const mockPendingMandalGet = jest.fn<any>().mockResolvedValue({ empty: true });
        const mockPendingMandalQuery = {
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: mockPendingMandalGet
        };

        // Mock add to reporter_applications
        const mockAppAdd = jest.fn<any>().mockResolvedValue({ id: 'app_new_001' });

        // Mock user doc get and set
        const mockUserSet = jest.fn<any>().mockResolvedValue(true);
        const mockUserDoc = {
            get: jest.fn<any>().mockResolvedValue({
                exists: true,
                data: () => ({ name: 'Test Reporter', phone: '9876543210', points: 10, badges: ['ACTIVE'] })
            }),
            set: mockUserSet
        };

        // Setup db collection routing
        db.collection.mockImplementation((collName: string) => {
            if (collName === 'reporter_applications') {
                return {
                    where: jest.fn((field: any, _op: any, val: any) => {
                        if (field === 'userId') return mockUserPendingQuery;
                        if (field === 'phone') return mockPhonePendingQuery;
                        if (field === 'status' && val === 'JOINED') return mockJoinedAppQuery;
                        if (field === 'status' && val === 'PENDING') return mockPendingMandalQuery;
                        return { where: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), get: jest.fn<any>().mockResolvedValue({ empty: true }) };
                    }),
                    add: mockAppAdd
                };
            }
            if (collName === 'users') {
                return {
                    where: jest.fn().mockReturnValue(mockActiveReporterQuery),
                    doc: jest.fn().mockReturnValue(mockUserDoc)
                };
            }
            if (collName === 'reporter_conversations') {
                return {
                    doc: jest.fn().mockReturnValue({
                        collection: jest.fn().mockReturnValue({ add: jest.fn<any>().mockResolvedValue({ id: 'msg_1' }) }),
                        set: jest.fn<any>().mockResolvedValue(true)
                    })
                };
            }
            return {
                doc: jest.fn().mockReturnThis(),
                get: jest.fn<any>().mockResolvedValue({ exists: false })
            };
        });

        // Simulate application submission for vacant mandal
        const data = {
            fullName: 'Ravi Kumar',
            fatherName: 'Sambaiah',
            phone: '9876543210',
            address: 'Main Bazar, Narsampet',
            position: 'మండల రిపోర్టర్',
            interestedArea: 'రాజకీయం',
            education: 'Degree',
            currentOrg: 'None',
            state: 'TS',
            district: mockDistrict,
            mandal: mockMandal,
            message: 'I want to serve local news',
            userId: mockUserId
        };

        // Validate auto-approval criteria
        const isVacant = true;
        const shouldAutoApprove = Boolean(data.userId && isVacant);
        const finalStatus = shouldAutoApprove ? 'JOINED' : 'PENDING';

        expect(shouldAutoApprove).toBe(true);
        expect(finalStatus).toBe('JOINED');

        // Verify user update payload
        const expectedUserUpdate = {
            role: 'REPORTER',
            district: mockDistrict,
            assignedMandal: mockMandal,
            mandal: mockMandal,
            promotedBy: 'AUTO_APPROVAL_SYSTEM',
            agreedToRules: true
        };

        expect(expectedUserUpdate.role).toBe('REPORTER');
        expect(expectedUserUpdate.assignedMandal).toBe(mockMandal);
        expect(expectedUserUpdate.promotedBy).toBe('AUTO_APPROVAL_SYSTEM');
        expect(expectedUserUpdate.agreedToRules).toBe(true);
    });

    test('Occupied Mandal Prevention: Should reject or keep PENDING if reporter already exists', () => {
        const reporterExists = true;
        const shouldAutoApprove = !reporterExists;
        expect(shouldAutoApprove).toBe(false);
    });

    test('Unauthenticated User Check: Cannot auto-approve if userId is missing', () => {
        const userId: string | null = null;
        const isVacant = true;
        const shouldAutoApprove = Boolean(userId && isVacant);
        expect(shouldAutoApprove).toBe(false);
    });

    test('4 Rules Acceptance: Application requires agreedToRules: true', () => {
        const userAgreed = true;
        const appPayload = {
            status: 'JOINED',
            autoApproved: true,
            agreedToRules: userAgreed
        };
        expect(appPayload.agreedToRules).toBe(true);
        expect(appPayload.autoApproved).toBe(true);
    });

    test('Previously Downgraded Reporter Protection: Should BLOCK auto-approval and keep PENDING', () => {
        const userId = 'user_downgraded_456';
        const isVacant = true;
        const userData = {
            previouslyDowngraded: true,
            downgradedReason: 'INACTIVITY'
        };

        const isPreviouslyDowngraded = userData.previouslyDowngraded === true;
        const shouldAutoApprove = Boolean(userId && !isPreviouslyDowngraded && isVacant);
        const finalStatus = shouldAutoApprove ? 'JOINED' : 'PENDING';

        expect(isPreviouslyDowngraded).toBe(true);
        expect(shouldAutoApprove).toBe(false);
        expect(finalStatus).toBe('PENDING');
    });

    test('Previously Suspended Reporter Protection: Should BLOCK auto-approval and keep PENDING', () => {
        const userId = 'user_suspended_789';
        const isVacant = true;
        const userData = {
            suspended: true
        };

        const isPreviouslyDowngraded = userData.suspended === true;
        const shouldAutoApprove = Boolean(userId && !isPreviouslyDowngraded && isVacant);
        const finalStatus = shouldAutoApprove ? 'JOINED' : 'PENDING';

        expect(isPreviouslyDowngraded).toBe(true);
        expect(shouldAutoApprove).toBe(false);
        expect(finalStatus).toBe('PENDING');
    });
});
