self.addEventListener('push', event => {
    const data = event.data.json();
    console.log('Push received:', data);
    
    const options = {
        body: data.body,
        icon: 'bell.png' // החלף בנתיב לסמל התראה אם יש לך כזה
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});