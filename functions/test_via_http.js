async function run() {
    const url = 'https://asia-south1-alfa-news-31bf7.cloudfunctions.net/triggerPushBroadcast';
    const payload = {
        data: {
            title: 'Test Notification via HTTP',
            body: 'If you receive this, the manual push notification system is working correctly!',
            topic: 'test_admin_notifications',
            channelId: 'general_news'
        }
    };

    console.log('Sending request to:', url);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error occurred:', error);
    }
}

run();
