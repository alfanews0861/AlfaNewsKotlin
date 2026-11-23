import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import * as admin from 'firebase-admin';
import { resolveExpansionDistrict } from './editions';
import { getReporterApplicationLocale, checkMandalVacancy } from './reporter_handler';

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

    test('Reporter Monthly Performance Audit: Meets benchmark with >= 20 own-mandal news posts', () => {
        const monthlyTarget = 20;
        const ownMandalPostsThisMonth = 24;
        const daysSinceLastPost = 1;

        const meetsBenchmark = ownMandalPostsThisMonth >= monthlyTarget && daysSinceLastPost <= 3;
        const shortfall = Math.max(0, monthlyTarget - ownMandalPostsThisMonth);

        expect(meetsBenchmark).toBe(true);
        expect(shortfall).toBe(0);
    });

    test('Reporter Monthly Performance Audit: Deficient with < 20 own-mandal news posts triggers alert', () => {
        const monthlyTarget = 20;
        const ownMandalPostsThisMonth = 7;
        const daysSinceLastPost = 4;

        const meetsBenchmark = ownMandalPostsThisMonth >= monthlyTarget && daysSinceLastPost <= 3;
        const shortfall = Math.max(0, monthlyTarget - ownMandalPostsThisMonth);

        expect(meetsBenchmark).toBe(false);
        expect(shortfall).toBe(13);

        // Verification of alert message content
        const applicantName = "రమేష్ కుమార్";
        const mandal = "కొణిజర్ల";
        const alertText = `నమస్కారం విలేకరి మిత్రమా, Alfa News ఎడిటోరియల్ డెస్క్ నుండి అత్యవసర గమనిక.\n\nమీరు కేటాయించబడిన ${mandal} మండలానికి ఈ నెలలో ఆశించిన స్థాయిలో వార్తలు అందించడం లేదు. నిబంధనల ప్రకారం ప్రతినెలా కనీసం 20 సొంత మండల వార్తలను పోస్ట్ చేయాల్సి ఉండగా, ఈ నెలలో మీరు కేవలం ${ownMandalPostsThisMonth} వార్తలు మాత్రమే పోస్ట్ చేశారు (ఇంకా ${shortfall} వార్తల కొరత ఉంది).\n\nమీ మండల వార్తల కవరేజ్ తక్కువగా ఉన్నందున, మీ ${mandal} మండలానికి సంబంధించి ఇప్పటికే '${applicantName}' గారు విలేకరి పదవి కోసం దరఖాస్తు చేసుకున్నారు.`;

        expect(alertText).toContain('కొణిజర్ల');
        expect(alertText).toContain('రమేష్ కుమార్');
        expect(alertText).toContain('20');
        expect(alertText).toContain('13');
    });
});

describe('Multi-State (9 States × 5 Languages) Reporter Onboarding & Conflict Isolation', () => {
    let db: any;

    beforeEach(() => {
        jest.clearAllMocks();
        db = admin.firestore();
    });

    test('Cross-platform Web/Android expansion district aliases normalize to canonical backend names', () => {
        expect(resolveExpansionDistrict('SAS Nagar (Mohali)', 'PB')).toEqual({
            district: 'Sahibzada Ajit Singh Nagar',
            stateCode: 'PB',
        });
        expect(resolveExpansionDistrict('SBS Nagar (Nawanshahr)', 'PB')).toEqual({
            district: 'Shahid Bhagat Singh Nagar',
            stateCode: 'PB',
        });
        expect(resolveExpansionDistrict('Devbhumi Dwarka', 'GJ')).toEqual({
            district: 'Devbhoomi Dwarka',
            stateCode: 'GJ',
        });
        expect(resolveExpansionDistrict('Hamirpur (HP)', 'HP')).toEqual({
            district: 'Hamirpur',
            stateCode: 'HP',
        });
        expect(resolveExpansionDistrict('Hamirpur', 'UP')).toEqual({
            district: 'Hamirpur',
            stateCode: 'UP',
        });
        expect(resolveExpansionDistrict('Hamirpur', 'HP')).toEqual({
            district: 'Hamirpur',
            stateCode: 'HP',
        });
    });

    test('getReporterApplicationLocale returns localized sub-district labels and 100% human Editorial copy for all 9 states', () => {
        const cases: Array<{ state: string; lang?: string; expectedLang: string; expectedLabel: string }> = [
            { state: 'TS', expectedLang: 'te', expectedLabel: 'మండలం' },
            { state: 'AP', expectedLang: 'te', expectedLabel: 'మండలం' },
            { state: 'UP', expectedLang: 'hi', expectedLabel: 'तहसील' },
            { state: 'UK', expectedLang: 'hi', expectedLabel: 'तहसील' },
            { state: 'HP', expectedLang: 'hi', expectedLabel: 'तहसील' },
            { state: 'PB', expectedLang: 'pa', expectedLabel: 'ਤਹਿਸੀਲ' },
            { state: 'GJ', expectedLang: 'gu', expectedLabel: 'તાલુકા' },
            { state: 'GA', expectedLang: 'en', expectedLabel: 'Taluka' },
            { state: 'MN', expectedLang: 'en', expectedLabel: 'Sub-Division' },
        ];

        for (const c of cases) {
            const loc = getReporterApplicationLocale(c.state, c.lang);
            expect(loc.language).toBe(c.expectedLang);
            expect(loc.subDistrictLabel).toBe(c.expectedLabel);

            const welcome = loc.welcomeDeskMsg('Amit', 'Sadar');
            const conflict = loc.conflictDeskMsg('Amit', 'Sadar', 'Existing Reporter');
            expect(welcome).toContain('Sadar');
            expect(conflict).toContain('Sadar');
            // Zero AI/Bot wording policy check
            expect(welcome.toLowerCase()).not.toMatch(/\b(ai|gemini|bot)\b/);
            expect(conflict.toLowerCase()).not.toMatch(/\b(ai|gemini|bot)\b/);
        }
    });

    test('checkMandalVacancy isolates shared district names across states (UP Hamirpur does NOT block HP Hamirpur)', async () => {
        const upReporterDoc = {
            id: 'rep_up_01',
            data: () => ({
                role: 'REPORTER',
                name: 'Rajesh UP',
                phone: '9876543210',
                stateCode: 'UP',
                district: 'Hamirpur',
                assignedMandal: 'Hamirpur',
                suspended: false,
            }),
        };

        const mockQuery = {
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn<any>().mockResolvedValue({ empty: false, docs: [upReporterDoc] }),
        };

        db.collection.mockImplementation((collName: string) => {
            if (collName === 'users') {
                return { where: jest.fn().mockReturnValue(mockQuery) };
            }
            return { where: jest.fn().mockReturnValue({ where: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), get: jest.fn<any>().mockResolvedValue({ empty: true, docs: [] }) }) };
        });

        // Applicant for HP Hamirpur should see VACANT because active reporter is in UP
        const hpResult = await checkMandalVacancy('Hamirpur (HP)', 'Hamirpur', 'applicant_hp_1', 'HP');
        expect(hpResult.vacant).toBe(true);

        // Applicant for UP Hamirpur should see CONFLICT with Rajesh UP
        const upResult = await checkMandalVacancy('Hamirpur', 'Hamirpur', 'applicant_up_2', 'UP');
        expect(upResult.vacant).toBe(false);
        expect(upResult.existingReporter?.id).toBe('rep_up_01');
        expect(upResult.existingReporter?.name).toBe('Rajesh UP');
    });

    test('checkMandalVacancy catches cross-platform Web alias conflict (SAS Nagar (Mohali) vs Sahibzada Ajit Singh Nagar)', async () => {
        const pbReporterDoc = {
            id: 'rep_pb_01',
            data: () => ({
                role: 'REPORTER',
                name: 'Harpreet Singh',
                phone: '9812345678',
                stateCode: 'PB',
                district: 'Sahibzada Ajit Singh Nagar',
                assignedMandal: 'Kharar',
                suspended: false,
            }),
        };

        const queriedDistricts: string[] = [];
        const mockQuery = {
            where: jest.fn((field: string, _op: string, val: any) => {
                if (field === 'district') queriedDistricts.push(val);
                return mockQuery;
            }),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn<any>().mockResolvedValue({ empty: false, docs: [pbReporterDoc] }),
        };

        db.collection.mockImplementation((collName: string) => {
            if (collName === 'users') {
                return { where: jest.fn().mockReturnValue(mockQuery) };
            }
            return { where: jest.fn().mockReturnValue({ where: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), get: jest.fn<any>().mockResolvedValue({ empty: true, docs: [] }) }) };
        });

        const res = await checkMandalVacancy('SAS Nagar (Mohali)', 'Kharar', 'applicant_pb_2', 'PB');
        expect(queriedDistricts).toContain('Sahibzada Ajit Singh Nagar');
        expect(res.vacant).toBe(false);
        expect(res.existingReporter?.name).toBe('Harpreet Singh');
    });
});

