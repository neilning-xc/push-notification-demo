console.log('service worker');
self.addEventListener('push', (event) => {
  const notification = event.data.json();
  console.log(notification);
  self.registration.showNotification(
    notification.title, 
    notification
  );
});
