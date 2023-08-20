const PUBLIC_KEY = 'BP2Z7MbywaWi3lD-0Th-df2uml6RTgsu7cFYtLBeCvj6bohvIIxixZy4Z7UA7VSBkcGtc-OaQTyIHa4mh37CJdQ'

function registerServiceWorker() {
  return navigator.serviceWorker
    .register('/service-worker.js')
    .then(function (registration) {
      console.log('Service worker successfully registered.');
      return registration;
    })
    .catch(function (err) {
      console.error('Unable to register service worker.', err);
    });
}

function askPermission() {
  return new Promise(function (resolve, reject) {
    const permissionResult = Notification.requestPermission(function (result) {
      resolve(result);
    });

    if (permissionResult) {
      permissionResult.then(resolve, reject);
    }
  }).then(function (permissionResult) {
    if (permissionResult !== 'granted') {
      throw new Error("We weren't granted permission.");
    }
  });
}

function subscribeUserToPush(serviceWorkerRegistration) {
  return serviceWorkerRegistration.pushManager.getSubscription().then((subscription) => {
    if (subscription !== null) {
      return subscription;
    }
    const subscribeOptions = {
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
    };
    return serviceWorkerRegistration.pushManager.subscribe(subscribeOptions);
  }).then(function (pushSubscription) {
    console.log(
      'Received PushSubscription: ',
      JSON.stringify(pushSubscription),
    );
    return pushSubscription;
  });;
}

async function checkSubscription(serviceWorkerRegistration) {
  const subscription = await serviceWorkerRegistration.pushManager.getSubscription();
  if (subscription === null) {
    return false;
  }
  const { data } = await getSubscription(subscription);
  if (data.success && data.id) {
    return true;
  }
  return false;
}

function getSubscription(subscription) {
  return fetch('http://localhost:4000/api/get-subscription/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subscription),
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Bad status code from server.');
      }
      return response.json();
    });
}

function removeSubscription(subscription) {
  return fetch('http://localhost:4000/api/remove-subscription/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subscription),
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Bad status code from server.');
      }
      return response.json();
    });
}

function sendSubscriptionToBackEnd(subscription) {
  return fetch('http://localhost:4000/api/save-subscription/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subscription),
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Bad status code from server.');
      }

      return response.json();
    })
    .then(function (responseData) {
      if (!(responseData.data && responseData.data.success)) {
        throw new Error('Bad response from server.');
      }
    });
}

function sendNotificationToAll(message) {
  return fetch('http://localhost:4000/api/notify-all/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Bad status code from server.');
      }

      return response.json();
    })
    .then(function (responseData) {
      if (!(responseData.data && responseData.data.success)) {
        throw new Error('Bad response from server.');
      }
    });
}

function sendNotificationToMe(subscription, message) {
  return fetch('http://localhost:4000/api/notify-me/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subscription, message }),
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Bad status code from server.');
      }

      return response.json();
    })
    .then(function (responseData) {
      if (!(responseData.data && responseData.data.success)) {
        throw new Error('Bad response from server.');
      }
    });
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray; 
};

function handleUI(serviceWorkerRegistration) {
  const subscribeCheckbox = document.getElementById('subscribeCheckbox');
  checkSubscription(serviceWorkerRegistration).then((isChecked) => {
    subscribeCheckbox.checked = isChecked;
  });
  subscribeCheckbox.addEventListener('input', async (event) => {
    const checked = event.target.checked;
    if (!checked) {
      // 取消订阅
      const subscription = await serviceWorkerRegistration.pushManager.getSubscription();
      if (subscription) {
        await removeSubscription(subscription);
        subscription.unsubscribe();
      }
    } else {
      // 订阅
      await askPermission();
      const sub = await subscribeUserToPush(serviceWorkerRegistration);
      sendSubscriptionToBackEnd(sub)
    }
  });

  const notifyAll = document.getElementById('notifyAll');
  const notifyMe = document.getElementById('notifyMe');
  notifyAll.addEventListener('click', (event) => {
    const title = document.getElementById('msgTitle').value;
    const body = document.getElementById('msgBody').value;
    const userName = document.getElementById('msgUserName').value;
    if (title && body) {
      sendNotificationToAll({ title: title, body: body, userName });
    }
  });
  notifyMe.addEventListener('click', async () => {
    const subscription = await serviceWorkerRegistration.pushManager.getSubscription();
    if (subscription) {
      const title = document.getElementById('msgTitle').value;
      const body = document.getElementById('msgBody').value;
      const userName = document.getElementById('msgUserName').value;
      if (title && body) {
        sendNotificationToMe(subscription, { title: title, body: body, userName });
      }
    }
  });
}

(async function main() {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  if (!('PushManager' in window)) {
    return;
  }

  const serviceWorkerRegistration = await registerServiceWorker();
  handleUI(serviceWorkerRegistration);
})();