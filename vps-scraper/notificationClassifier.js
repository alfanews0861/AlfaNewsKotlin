'use strict';

const EMERGENCY_BREAKING_KEYWORDS = [
    'భూకంపం', 'తుఫాను', 'భారీ వర్షాలు', 'వరదలు', 'రెడ్ అలర్ట్', 'సునామి',
    'ప్రమాదం', 'అగ్నిప్రమాదం', 'పేలుడు', 'బంద్', 'సెలవు ప్రకటన', 'సెలవులు ప్రకటన',
    'ఫలితాలు విడుదల', 'నోటిఫికేషన్ విడుదల', 'బడ్జెట్', 'క్యాబినెట్ నిర్ణయం',
    'సుప్రీంకోర్టు తీర్పు', 'హైకోర్టు తీర్పు', 'ఎన్నికల షెడ్యూల్', 'బ్రేకింగ్',
    'red alert', 'earthquake', 'cyclone', 'cabinet decision', 'results released'
];

function buildCompactNotificationTitle(rawHeadline, explicitTitle) {
    const candidate = (explicitTitle && typeof explicitTitle === 'string' && explicitTitle.trim().length >= 8)
        ? explicitTitle.trim()
        : String(rawHeadline || '').trim();
    if (!candidate) return '';
    return candidate.length > 72 ? `${candidate.substring(0, 70).trim()}...` : candidate;
}

/**
 * Computes notification metadata for VPS-scraped stories so high-quality general/category/district
 * journalism is eligible for scheduled notifications (instead of only top-leader politics).
 */
function classifyScraperNotification({
    parsed = {},
    cleanedHeadline = '',
    cleanedContent = '',
    isTopLeaderNews = false,
}) {
    const rawScore = (typeof parsed.qualityScore === 'number' && !isNaN(parsed.qualityScore))
        ? Math.max(0, Math.min(10, Math.round(parsed.qualityScore * 10) / 10))
        : 5.0;

    const qualityScore = isTopLeaderNews ? Math.max(9.0, rawScore) : rawScore;
    const isPersonalPraise = parsed.qualitySignals?.isPersonalPraise === true;

    const combinedLower = `${cleanedHeadline} ${cleanedContent}`.toLowerCase();
    const hasMajorBreakingSignal = EMERGENCY_BREAKING_KEYWORDS.some(k => combinedLower.includes(k.toLowerCase()));

    const explicitBreaking = parsed.isBreaking === true || String(parsed.tone || '').toUpperCase() === 'BREAKING';
    const isBreaking = !isPersonalPraise && (
        isTopLeaderNews ||
        (explicitBreaking && qualityScore >= 8.0) ||
        (hasMajorBreakingSignal && qualityScore >= 8.2)
    );

    const notificationWorthy = !isPersonalPraise && (
        isBreaking ||
        parsed.notificationWorthy === true ||
        qualityScore >= 7.5
    );

    let tone = 'NORMAL';
    if (isPersonalPraise) {
        tone = 'SOFT';
    } else if (isBreaking) {
        tone = 'BREAKING';
    } else if (qualityScore >= 8.0 || String(parsed.tone || '').toUpperCase() === 'IMPORTANT') {
        tone = 'IMPORTANT';
    }

    const notificationTitle = notificationWorthy
        ? buildCompactNotificationTitle(cleanedHeadline, parsed.notificationTitle)
        : '';

    return {
        qualityScore,
        isBreaking,
        notificationWorthy,
        tone,
        notificationTitle,
    };
}

module.exports = {
    classifyScraperNotification,
    buildCompactNotificationTitle,
};
