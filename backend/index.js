const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Datastore = require('nedb');
const webpush = require('web-push');
const dotenv = require('dotenv');

dotenv.config();
const db = new Datastore({filename: 'subscription.db'});
db.loadDatabase();

const app = express();
app.use(cors());
app.use(bodyParser.json());
const port = 4000;
const vapidKeys = {
  publicKey: process.env.PUBLIC_KEY,
  privateKey: process.env.PRIVATE_KEY,
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

function findSubscription(endpoint) {
  return new Promise((resolve, reject) => {
    db.find({ endpoint }, function(err, docs) {
      if (err) {
        reject(err);
      }
      if (docs.length >= 1) {
        resolve(docs[0]);
      } else {
        resolve(null);
      }
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

function removeSubscription(endpoint) {
  return new Promise((resolve, reject) => {
    db.remove({ endpoint }, {}, function (err, numRemoved) {
      if (err) {
        reject(err);
      }
      resolve(numRemoved);
    });
  });
}

function triggerPushMsg (subscription, dataToSend) {
  // 国内调试需要添加本地代理proxy参数
  return webpush.sendNotification(subscription, JSON.stringify(dataToSend), { proxy: 'http://127.0.0.1:7890' }).catch((err) => {
    if (err.statusCode === 404 || err.statusCode === 410) {
      return deleteSubscription(subscription._id);
    } else {
      throw err;
    }
  });
};

app.get('/', async (req, res) => res.send('hello world'));
app.post('/api/get-subscription/', async (req, res) => {
  const subscription = req.body;
  const doc = await findSubscription(subscription.endpoint);
  if (doc) {
    res.status(201);
    res.json({data: {success: true, id: doc._id}});
  } else {
    res.status(200);
    res.json({data: {success: true}});
  }
});
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
app.post('/api/remove-subscription/', async (req, res) => {
  const subscription = req.body;
  await removeSubscription(subscription);
  res.status(200);
  res.json({data: { success: true }});
});
app.post('/api/notify-all/', async (req, res) => {
  const { title, body } = req.body;
  const dataToSend = {
    title: title,
    body: body,
    icon: 'https://hk.trip.com/trip.ico'
  };

  try {
    const subscriptions = await findAllSubscription();
    for (let i = 0; i < subscriptions.length; i++) {
      const subscription = subscriptions[i];
      await triggerPushMsg(subscription, dataToSend);
    }
    res.json({ data: { success: true } });
  } catch (err) {
    res.status(500);
    res.json({
      error: {
        message: `Send all subscriptions failed: ` +
          `'${err.message}'`
      }
    });
  }
});

app.post('/api/notify-me/', async (req, res) => {
  const { message, subscription } = req.body;
  const doc = await findSubscription(subscription.endpoint);
  if (doc) {
    const { title, body } = message;
    const dataToSend = {
      title: title,
      body: body,
      icon: 'https://hk.trip.com/trip.ico'
    }; 
     
    await triggerPushMsg(subscription, dataToSend);
    res.json({ data: { success: true } });
    return;
  } 
  res.status(500);
  res.json({ data: { success: false } });
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));