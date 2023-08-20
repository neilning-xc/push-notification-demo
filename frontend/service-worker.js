async function reportNotify(notification) {
  const subscription = await self.registration.pushManager.getSubscription();
  return fetch('http://localhost:4000/api/report-push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ notification, subscription }),
  });
}

async function reportClick(notification) {
  const subscription = await self.registration.pushManager.getSubscription();
  return fetch('http://localhost:4000/api/report-click', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ notification, subscription }),
  });
}

function showNotification(notification) {
  const { title, body } = notification;
  const actions = [
    {
      action: 'coffee-action',
      type: 'button',
      title: 'Coffee',
      icon: '/images/coffee-action.png',
    },
    {
      action: 'book-action',
      type: 'text',
      title: 'Book',
      icon: '/images/book-action.png',
      placeholder: 'Type text here',
    }
  ];
  const option = {
    body,
    icon: '/images/dog.jpg',
    badge: '/images/badge.png',
    actions,
    vibrate: [
      500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450, 110, 200, 110, 170,
      40, 500,
    ],
    sound: '/sound/msg-sound.wav',
    timestamp: new Date().getTime(),
    data: {
      msgUrl: '/detail.html',
    }
  };
  return self.registration.showNotification(
    title, 
    option
  );
}

function mergeNotification(notification) {
  // 当前推送数据
  const { userName, body } = notification;
  const promiseChain = self.registration.getNotifications().then((notifications) => {
    console.log("🚀 ~ file: service-worker.js:76 ~ promiseChain ~ notifications:", notifications);
    let currentNotification;
    for (let i = 0; i < notifications.length; i++) {
      if (notifications[i].data && notifications[i].data.userName === userName) {
        currentNotification = notifications[i];
      }
    }
    // currentNotification指得是老的未关闭的通知
    return currentNotification;
  }).then((currentNotification) => {
    let notificationTitle;
    const options = {
      icon: '/images/dog.jpg',
    }
    if (currentNotification) {
      const messageCount = currentNotification.data.newMessageCount + 1;
      options.body = `You have ${messageCount} new messages from ${userName}.`;
      options.data = {
        userName: userName,
        newMessageCount: messageCount
      };
      notificationTitle = `New Messages from ${userName}`;
  
      // Remember to close the old notification.
      currentNotification.close();
    } else {
      options.body = `"${body}"`;
      options.data = {
        userName: userName,
        newMessageCount: 1
      };
      notificationTitle = `New Message from ${userName}`;
    }
  
    return self.registration.showNotification(
      notificationTitle,
      options
    );
  });
  return promiseChain;
}

self.addEventListener('push', (event) => {
  const notification = event.data.json();
  const notifyPromise = showNotification(notification);
  // const notifyPromise = mergeNotification(notification);

  // 上报推送成功事件
  const reportPromise = reportNotify(notification);
  const promiseChain = Promise.all([reportPromise, notifyPromise]);
  // 以上两个promise都成功时，service worker才会执行结束
  event.waitUntil(promiseChain);
});

function isClientFocused() {
  return clients
    .matchAll({
      type: 'window',
      includeUncontrolled: true,
    })
    .then((windowClients) => {
      let clientIsFocused = false;

      for (let i = 0; i < windowClients.length; i++) {
        const windowClient = windowClients[i];
        if (windowClient.focused) {
          clientIsFocused = true;
          break;
        }
      }

      return clientIsFocused;
    });
}

function handleActionClick(event) {
  switch (event.action) {
    case 'coffee-action':
      console.log("User ❤️️'s coffee.");
      break;
    case 'book-action':
      console.log("User ❤️️'s book.");
      break;
    default:
      console.log(`Unknown action clicked: '${event.action}'`);
      break;
  }
}

self.addEventListener('notificationclick', (event) => {
  const clickedNotification = event.notification;
  const { data } = clickedNotification;
  const msgUrl = data.msgUrl || '/detail.html';
  handleActionClick(event);

  const urlToOpen = new URL(msgUrl, self.location.origin).href;
  const promiseChain = clients
    .matchAll({
      type: 'window',
      includeUncontrolled: true,
    })
    .then((windowClients) => {
      let matchingClient = null;
      for (let i = 0; i < windowClients.length; i++) {
        const windowClient = windowClients[i];
        if (windowClient.url === urlToOpen) {
          matchingClient = windowClient;
          break;
        }
      }
      if (matchingClient) {
        return matchingClient.focus();
      } else {
        return clients.openWindow(urlToOpen);
      }
    }).then(() => {
      return clickedNotification.close();
    });

  const reportPromise = reportClick();
  event.waitUntil(Promise.all([reportPromise, promiseChain]));
});

self.addEventListener('notificationclose', function (event) {
  const dismissedNotification = event.notification;
  console.log("🚀 ~ file: service-worker.js:90 ~ dismissedNotification:", dismissedNotification);
});
