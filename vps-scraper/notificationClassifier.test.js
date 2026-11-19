'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyScraperNotification } = require('./notificationClassifier');

test('marks high-quality general category news (qualityScore >= 7.5) as notificationWorthy without breaking', () => {
    const res = classifyScraperNotification({
        parsed: { qualityScore: 7.8 },
        cleanedHeadline: 'ఐపీఎల్ 2026: హైదరాబాద్ ఘన విజయం, పాయింట్ల పట్టికలో టాప్',
        cleanedContent: 'సన్‌రైజర్స్ హైదరాబాద్ జట్టు అద్భుత ప్రదర్శనతో విజయం సాధించింది.',
        isTopLeaderNews: false,
    });

    assert.equal(res.notificationWorthy, true);
    assert.equal(res.isBreaking, false);
    assert.equal(res.tone, 'NORMAL');
    assert.ok(res.notificationTitle.length > 0);
});

test('marks major non-leader emergency/cabinet news with qualityScore >= 8.2 as BREAKING', () => {
    const res = classifyScraperNotification({
        parsed: { qualityScore: 8.6 },
        cleanedHeadline: 'బంగాళాఖాతంలో తీవ్ర తుఫాను హెచ్చరిక.. కోస్తా జిల్లాలకు రెడ్ అలర్ట్',
        cleanedContent: 'భారీ వర్షాలు కురిసే అవకాశం ఉందని వాతావరణ శాఖ హెచ్చరించింది.',
        isTopLeaderNews: false,
    });

    assert.equal(res.isBreaking, true);
    assert.equal(res.notificationWorthy, true);
    assert.equal(res.tone, 'BREAKING');
});

test('excludes low-quality filler (qualityScore < 7.5) from notificationWorthy', () => {
    const res = classifyScraperNotification({
        parsed: { qualityScore: 5.2 },
        cleanedHeadline: 'స్థానిక కార్యాలయంలో సాధారణ సమావేశం',
        cleanedContent: 'రోజువారీ సమీక్ష జరిగింది.',
        isTopLeaderNews: false,
    });

    assert.equal(res.notificationWorthy, false);
    assert.equal(res.isBreaking, false);
    assert.equal(res.notificationTitle, '');
});

test('blocks personal praise from notifications even if score is high', () => {
    const res = classifyScraperNotification({
        parsed: { qualityScore: 8.5, qualitySignals: { isPersonalPraise: true } },
        cleanedHeadline: 'నాయకుడికి ఘన సన్మానం',
        cleanedContent: 'అభిమానులు పుష్పగుచ్ఛాలు అందజేశారు.',
        isTopLeaderNews: false,
    });

    assert.equal(res.notificationWorthy, false);
    assert.equal(res.isBreaking, false);
    assert.equal(res.tone, 'SOFT');
});
