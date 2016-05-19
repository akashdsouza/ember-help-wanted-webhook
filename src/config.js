export default {
  ip:           process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1',
  port:         process.env.OPENSHIFT_NODEJS_PORT || 8080,

  couch: {
    host: process.env.COUCHDB_HOST || 'http://locks.cloudant.com',
    port: process.env.COUCHDB_PORT || '5984',
    username: process.env.COUCHDB_USERNAME || 'username',
    password: process.env.COUCHDB_PASSWORD || 'password',
    dbName: 'help-wanted'
  },

  webhook: {
    path: '/issue-handler',
    secret: process.env.WEBHOOK_SECRET || 'oursecrethere',
  },
};
