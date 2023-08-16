self.addEventListener('push', (event) => {
  const notification = event.data.json();
  const notifyPromise = self.registration.showNotification(
    notification.title, 
    notification
  );

  // 上报推送成功事件
  // const reportPromise = fetch('http://localhost:4000/api/report-push', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //   },
  //   body: notification,
  // });

  // const promiseChain = Promise.all([reportPromise, notifyPromise]);
  // 以上两个promise都成功时，service worker才会执行结束
  event.waitUntil(notifyPromise);
});
