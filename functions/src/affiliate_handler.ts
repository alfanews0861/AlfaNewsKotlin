import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as crypto from "crypto";
import { processProductWithAI } from "./geminiService";

const db = admin.firestore();

interface AffiliateConfig {
    amazonAccessKey: string;
    amazonSecretKey: string;
    amazonAssociateTag: string;
    flipkartId: string;
    flipkartToken: string;
}

/**
 * AWS Signature V4 implementation for PA API 5.0
 */
function signAmazonRequest(
    payload: string,
    accessKey: string,
    secretKey: string,
    region: string,
    host: string,
    target: string
) {
    const amzDate = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const service = 'ProductAdvertisingAPI';
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

    const canonicalHeaders = `content-encoding:amz-1.0\ncontent-type:application/json; charset=utf-8\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:${target}\n`;
    const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target';
    const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');

    const canonicalRequest = ['POST', '/paapi5/searchitems', '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const stringToSign = [algorithm, amzDate, credentialScope, crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');

    const kDate = crypto.createHmac('sha256', 'AWS4' + secretKey).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();

    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
    const authorizationHeader = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Encoding': 'amz-1.0',
        'X-Amz-Date': amzDate,
        'X-Amz-Target': target,
        'Authorization': authorizationHeader
    };
}

async function fetchAmazonDeals(config: AffiliateConfig) {
    const host = 'webservices.amazon.in';
    const region = 'eu-west-1'; // India PA API region
    const target = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems';

    const payload = JSON.stringify({
        Keywords: 'Smartphone Deals',
        Resources: ['ItemInfo.Title', 'ItemInfo.ByLineInfo', 'Images.Primary.Large', 'Offers.Listings.Price'],
        PartnerTag: config.amazonAssociateTag,
        PartnerType: 'Associates',
        Marketplace: 'www.amazon.in',
        ItemCount: 3
    });

    const headers = signAmazonRequest(payload, config.amazonAccessKey, config.amazonSecretKey, region, host, target);

    try {
        const response = await fetch(`https://${host}/paapi5/searchitems`, {
            method: 'POST',
            headers,
            body: payload
        });
        const data: any = await response.json();
        return data.SearchResult?.Items || [];
    } catch (e) {
        console.error("Amazon Fetch Error:", e);
        return [];
    }
}

async function fetchFlipkartDeals(config: AffiliateConfig) {
    // Note: Flipkart API URLs are dynamic and category-based.
    // For this example, we'll hit the Top Sellers API if available, or a mock request structure.
    const url = `https://affiliate-api.flipkart.net/affiliate/1.0/topSelling.json?trackingId=${config.flipkartId}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Fk-Affiliate-Id': config.flipkartId,
                'Fk-Affiliate-Token': config.flipkartToken
            }
        });
        const data: any = await response.json();
        return data.topSellingProductsInfoList || [];
    } catch (e) {
        console.error("Flipkart Fetch Error:", e);
        return [];
    }
}

export const scheduleDailyAffiliateDeals = onSchedule({
    schedule: "0 3 * * *",
    timeZone: "Asia/Kolkata",
    memory: "1GiB",
    timeoutSeconds: 540
}, async (event) => {
    console.log("[AFFILIATE] Starting daily product fetch...");

    const configDoc = await db.collection('configs').doc('affiliateApi').get();
    if (!configDoc.exists) {
        console.error("[AFFILIATE] Config missing.");
        return;
    }
    const config = configDoc.data() as AffiliateConfig;

    const amazonItems = await fetchAmazonDeals(config);
    const flipkartItems = await fetchFlipkartDeals(config);

    const allProducts = [
        ...amazonItems.map((item: any) => ({
            title: item.ItemInfo.Title.DisplayValue,
            url: item.DetailPageURL,
            imageUrl: item.Images.Primary.Large.URL,
            price: item.Offers?.Listings?.[0]?.Price?.DisplayAmount,
            source: 'Amazon'
        })),
        ...flipkartItems.map((item: any) => ({
            title: item.productBaseInfoV1.title,
            url: item.productBaseInfoV1.productUrl,
            imageUrl: item.productBaseInfoV1.imageUrls['400x400'],
            price: item.productBaseInfoV1.flipkartSellingPrice.amount,
            source: 'Flipkart'
        }))
    ];

    for (const product of allProducts) {
        try {
            const aiResult = await processProductWithAI(`${product.title} - Price: ${product.price} at ${product.source}`);

            if (aiResult) {
                await db.collection('news').add({
                    type: 'affiliate',
                    headline: { telugu: aiResult.headline, english: aiResult.headlineEn },
                    content: {
                        telugu: `${aiResult.content}\n\nమరిన్ని వివరాలకు ఇక్కడ క్లిక్ చేయండి.`,
                        english: `${aiResult.contentEn}\n\nClick here for more details.`
                    },
                    mediaUrl: product.imageUrl,
                    mediaType: 'image',
                    affiliateUrl: product.url,
                    category: aiResult.category || 'టెక్నాలజీ',
                    reporter: { id: 'BOT_Affiliate', name: `${product.source} Deals` },
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    status: "published",
                    approved: true,
                    aiProcessed: true,
                    location: "India"
                });
                console.log(`[AFFILIATE] Posted deal: ${product.title}`);
            }
        } catch (err: any) {
            console.error(`[AFFILIATE] Processing error for ${product.title}:`, err.message);
        }
    }
});
