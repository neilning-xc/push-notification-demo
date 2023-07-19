const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const webpush = require('web-push');

const db = new Datastore({filename: 'subscription.db'});
db.loadDatabase();

const app = express();
app.use(cors());
app.use(bodyParser.json());
const port = 4000;
const vapidKeys = {
  publicKey: 'BHZRzn1ga45VmNm_8LCUJpbvKxZ_D2CBSsTkfkqKEPl6RAOd57BwFZ6piN9qmeMql9_5804lM-ZGYuzNc6Tr55U',
  privateKey: 'Z_5zfkBK2Yn_ng8oHtQ5WtUZkiFMaEotcYETu4crOkc',
};
webpush.setVapidDetails(
  'mailto:xcning@trip.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey,
);

function saveSubscriptionToDatabase(subscription) {
  return new Promise(function (resolve, reject) {
    db.insert(subscription, function (err, newDoc) {
      if (err) {
        reject(err);
        return;
      }

      resolve(newDoc._id);
    });
  });
}



app.get('/', async (req, res) => res.send('hello world'));
app.post('/api/save-subscription/', async (req, res) => {
  if (!req.body || !req.body.endpoint) {
    res.status(400);
    res.json({
      error: {
        code: '400',
        message: 'Subscription must have an endpoint.',
      },
    });
    return;
  }

  return saveSubscriptionToDatabase(req.body)
  .then(function (subscriptionId) {
    res.json({data: {success: true, subscriptionId}});
  })
  .catch(function (err) {
    res.status(500);
    res.json(
      {
        error: {
          code: '500',
          message:
            'save subscription error',
        },
      }
    );
  });
});

function findAllSubscription() {
  return new Promise((resolve, reject) => {
    db.find({}, function(err, docs) {
      if (err) {
        reject(err)
      }
      resolve(docs);
    });
  });
}

function deleteSubscription(id) {
  return new Promise((resolve, reject) => {
    db.remove({ _id: id }, {}, function (err, numRemoved) {
      if (err) {
        reject(err);
      }
      resolve(id);
    });
  });
  
}

function triggerPushMsg (subscription, dataToSend) {
  console.log(subscription, dataToSend);
  return webpush.sendNotification(subscription, JSON.stringify(dataToSend), { proxy: 'https://127.0.0.1:7890' }).then((response) => {
    console.log(response);
  }).catch((err) => {
    if (err.statusCode === 404 || err.statusCode === 410) {
      console.log('Subscription has expired or is no longer valid: ', err);
      return deleteSubscription(subscription._id);
    } else {
      throw err;
    }
  });
};

app.get('/api/notify-all/', async (req, res) => {
  const dataToSend = {
    notification: {
      title: 'Example title',
      body: 'This is a example body for notification',
      icon: 'https://hk.trip.com/trip.ico'
    }
  };

  return findAllSubscription().then(function (subscriptions) {
    let promiseChain = Promise.resolve();
    for (let i = 0; i < subscriptions.length; i++) {
      const subscription = subscriptions[i];
      promiseChain = promiseChain.then(async () => {
        const pushResponse = await triggerPushMsg(subscription, dataToSend);
        console.log(pushResponse);
      });
    }
    return promiseChain;
  }).then(() => {
    res.json({ data: { success: true } });
  }).catch(function(err) {
    res.status(500);
    res.json({
        error: {
        message: `Send all subscriptions failed: ` +
            `'${err.message}'`
        }
    });
  });
});


app.listen(port, () => console.log(`Example app listening on port ${port}!`));