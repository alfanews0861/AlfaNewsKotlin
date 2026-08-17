const admin = require('firebase-admin');

if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'alfa-news-31bf7'
    });
}

const message = {
    notification: {
        title: 'Test Notification from CLI',
        body: 'If you see this, the manual push notification system is working correctly!'
    },
    topic: 'test_admin_notifications'
};

admin.messaging().send(message)
    .then(response => {
        console.log('Successfully sent message:', response);
        process.exit(0);
    })
    .catch(error => {
        console.error('Error sending message:', error);
        process.exit(1);
    });
