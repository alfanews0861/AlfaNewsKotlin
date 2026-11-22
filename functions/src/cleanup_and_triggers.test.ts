import { describe, test, expect, jest, beforeEach } from '@jest/globals';

const mockCreate = jest.fn<any>();
const mockAdd = jest.fn<any>();

jest.mock('firebase-admin', () => {
    const mockFirestore: any = jest.fn(() => ({
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                create: mockCreate,
                get: jest.fn(),
                update: jest.fn(),
                delete: jest.fn(),
            })),
            add: mockAdd,
            where: jest.fn(),
        })),
        batch: jest.fn(() => ({
            delete: jest.fn(),
            commit: jest.fn(),
        })),
    }));
    mockFirestore.FieldValue = {
        serverTimestamp: jest.fn(() => 'MOCK_TS'),
        increment: jest.fn((n: number) => `INC_${n}`),
        delete: jest.fn(() => 'MOCK_DEL'),
    };
    mockFirestore.Timestamp = {
        fromDate: jest.fn((d: Date) => d),
    };
    return {
        apps: [{}],
        initializeApp: jest.fn(),
        firestore: mockFirestore,
        storage: jest.fn(() => ({ bucket: jest.fn() })),
        messaging: jest.fn(() => ({ send: jest.fn() })),
    };
});

import {
    CLEANUP_RETENTION_DAYS,
    computeCleanupRetentionCutoff,
    chunkDocumentIdsForLogging,
} from './auto_content_handler';
import { processNewsPostUpdateTransition } from './news_handler';
import { enqueueNewsProcessing } from './utils';

describe('cleanupOldNews 120-day retention & structured logging helpers', () => {
    test('uses 120-day retention period and computes exact cutoff date', () => {
        expect(CLEANUP_RETENTION_DAYS).toBe(120);
        const now = new Date('2026-11-21T03:00:00.000Z');
        const cutoff = computeCleanupRetentionCutoff(now, CLEANUP_RETENTION_DAYS);
        const expected = new Date(now.getTime());
        expected.setDate(expected.getDate() - 120);
        expect(cutoff.toISOString()).toBe(expected.toISOString());
    });

    test('chunks document IDs safely for Cloud Logging manifests', () => {
        expect(chunkDocumentIdsForLogging([])).toEqual([]);
        const ids = Array.from({ length: 1205 }, (_, i) => `doc_${i}`);
        const chunks = chunkDocumentIdsForLogging(ids, 500);
        expect(chunks).toHaveLength(3);
        expect(chunks[0]).toHaveLength(500);
        expect(chunks[1]).toHaveLength(500);
        expect(chunks[2]).toHaveLength(205);
        expect(chunks.flat()).toEqual(ids);
    });
});

describe('Consolidated onNewsPostUpdated transition guard & routing', () => {
    const handleViewMilestones = jest.fn<any>();
    const recordApproved = jest.fn<any>();
    const dispatchNotification = jest.fn<any>();
    const dispatchSocial = jest.fn<any>();

    beforeEach(() => {
        jest.clearAllMocks();
        handleViewMilestones.mockResolvedValue(false);
        recordApproved.mockResolvedValue({ counted: true, reporterId: 'rep_1' });
        dispatchNotification.mockResolvedValue(true);
        dispatchSocial.mockResolvedValue(undefined);
    });

    test('immediately skips archived or cleanup-touched documents with zero side effects', async () => {
        const res1 = await processNewsPostUpdateTransition(
            'post_1',
            { approved: true, status: 'published' },
            { approved: false, status: 'archived' },
            { handleViewMilestones, recordApproved, dispatchNotification, dispatchSocial }
        );
        expect(res1.skipped).toBe(true);
        expect(res1.reason).toBe('archived_or_cleanup');

        const res2 = await processNewsPostUpdateTransition(
            'post_2',
            { approved: true },
            { approved: true, lastCleanupAt: 'TS' },
            { handleViewMilestones, recordApproved, dispatchNotification, dispatchSocial }
        );
        expect(res2.skipped).toBe(true);
        expect(handleViewMilestones).not.toHaveBeenCalled();
        expect(recordApproved).not.toHaveBeenCalled();
        expect(dispatchNotification).not.toHaveBeenCalled();
        expect(dispatchSocial).not.toHaveBeenCalled();
    });

    test('does not loop or re-dispatch when already approved post receives passive update', async () => {
        const res = await processNewsPostUpdateTransition(
            'post_3',
            { approved: true, isReporter: true, longViews: 100, socialAutoPosted: false },
            { approved: true, isReporter: true, longViews: 100, socialAutoPosted: true },
            { handleViewMilestones, recordApproved, dispatchNotification, dispatchSocial }
        );
        expect(res.skipped).toBe(false);
        expect(res.approvalDispatched).toBe(false);
        expect(handleViewMilestones).not.toHaveBeenCalled();
        expect(recordApproved).not.toHaveBeenCalled();
        expect(dispatchNotification).not.toHaveBeenCalled();
        expect(dispatchSocial).not.toHaveBeenCalled();
    });

    test('dispatches count, breaking notification, and social auto-post on false -> true approval', async () => {
        const res = await processNewsPostUpdateTransition(
            'post_4',
            { approved: false, status: 'PROCESSING_VIDEO', isReporter: true, longViews: 0 },
            { approved: true, status: 'published', isReporter: true, longViews: 0, youtubeUrl: 'https://youtube.com/watch?v=abc12345678', videoProcessed: true },
            { handleViewMilestones, recordApproved, dispatchNotification, dispatchSocial }
        );
        expect(res.skipped).toBe(false);
        expect(res.approvalDispatched).toBe(true);
        expect(recordApproved).toHaveBeenCalledTimes(1);
        expect(dispatchNotification).toHaveBeenCalledTimes(1);
        expect(dispatchSocial).toHaveBeenCalledTimes(1);
    });

    test('respects pipelineHandled and activityCounted flags to avoid duplicate work', async () => {
        await processNewsPostUpdateTransition(
            'post_5',
            { approved: false },
            { approved: true, activityCounted: true, pipelineHandled: true },
            { handleViewMilestones, recordApproved, dispatchNotification, dispatchSocial }
        );
        expect(recordApproved).not.toHaveBeenCalled();
        expect(dispatchNotification).not.toHaveBeenCalled();
        expect(dispatchSocial).not.toHaveBeenCalled();
    });

    test('triggers view milestone check only when longViews changes for a reporter post', async () => {
        handleViewMilestones.mockResolvedValueOnce(true);
        const res = await processNewsPostUpdateTransition(
            'post_6',
            { approved: true, isReporter: true, longViews: 499 },
            { approved: true, isReporter: true, longViews: 505 },
            { handleViewMilestones, recordApproved, dispatchNotification, dispatchSocial }
        );
        expect(res.milestoneAwarded).toBe(true);
        expect(handleViewMilestones).toHaveBeenCalledTimes(1);
        expect(recordApproved).not.toHaveBeenCalled();
    });
});

describe('enqueueNewsProcessing loop-safe video queue helper', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('deduplicates concurrent VIDEO Phase 2 jobs via deterministic doc create()', async () => {
        mockCreate.mockResolvedValueOnce(undefined);
        const first = await enqueueNewsProcessing('vid_123', 'VIDEO', 'PHASE_1_VIDEO_HANDOFF', false);
        expect(first).toBe(true);
        expect(mockCreate).toHaveBeenCalledTimes(1);

        // Second concurrent call hits ALREADY_EXISTS (code 6) and cleanly deduplicates without throwing
        mockCreate.mockRejectedValueOnce({ code: 6, message: 'ALREADY_EXISTS' });
        const second = await enqueueNewsProcessing('vid_123', 'VIDEO', 'PHASE_1_VIDEO_HANDOFF', false);
        expect(second).toBe(false);
    });

    test('enqueues REPROCESS jobs via add()', async () => {
        mockAdd.mockResolvedValueOnce({ id: 'job_1' });
        const queued = await enqueueNewsProcessing('post_99', 'REPROCESS', 'AUTO_RETRY', true);
        expect(queued).toBe(true);
        expect(mockAdd).toHaveBeenCalledTimes(1);
    });
});
