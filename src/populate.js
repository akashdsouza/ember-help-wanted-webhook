#!/usr/bin/env node

import GitHubApi from 'github';
import Promise from 'bluebird';
import linkHeaderParser from 'parse-link-header';
import nano from 'nano';

import IssueHandler from './lib/issue-handler';
import DataStore from './lib/data-store';
import logger from './lib/logger';
import repos from './repos';
import config from './config';


const repoInfo = process.argv[2];

if (!repoInfo) {
  logger.error('Pass a repo as arg. e.g., emberjs/ember.js');
  process.exit(1);
}

if (!repos[repoInfo]) {
  logger.error('Ensure repo configuration is added to the repos.js file');
  process.exit(1);
}

const [ orgName, repoName ] = repoInfo.split('/');
const github = new GitHubApi({
  version: '3.0.0',
  protocol: 'https',
  debug: true,
  headers: {
    'user-agent': 'Ember help wanted indexer'
  }
});

const fetchIssues = Promise.promisify(github.issues.repoIssues);

const populateIssues = (pageNo=1) => {
  let issuesToProcess = [];
  return new Promise(function(resolve, reject) {
    const fetchIssuesInBatch = (pageNo=1) => {
      fetchIssues({
        user: orgName,
        repo: repoName,
        state: 'open',
        per_page: 100,
        page: pageNo
      }).then(issues => {
        issuesToProcess = issuesToProcess.concat(issues);
        if (issues.length === 100 && issues.meta) {
          const linkHeaderInfo = linkHeaderParser(issues.meta.link);
          if (linkHeaderInfo.next && linkHeaderInfo.last.page >= linkHeaderInfo.next.page) {
            fetchIssuesInBatch(linkHeaderInfo.next.page);
          }
        } else {
          resolve(issuesToProcess);
        }
      });
    }
    fetchIssuesInBatch();
  });
};

populateIssues().then(function(issueResults) {
  const unauthedCouchIssuesDB = nano(`${config.couch.host}:${config.couch.port}/${config.couch.dbName}`);

  unauthedCouchIssuesDB.auth(config.couch.username, config.couch.password, function (err, body, headers) {
    if (err) {
      logger.info(err);
      return;
    }

    const couchIssuesDB = require('nano')({
      url: `${config.couch.host}:${config.couch.port}/${config.couch.dbName}`,
      cookie: headers['set-cookie']
    });
    Promise.promisifyAll(couchIssuesDB);
    const dataStore = new DataStore(couchIssuesDB);
    const issueHandler = new IssueHandler(dataStore, repos);

    const issues = issueResults.filter(issue => !issue['pull_request']);
    logger.info(`No of issues from the api: ${issues.length}`);
    issueHandler.bulkAdd(repoInfo, issues).then(function() {
      logger.info(`Success ${repoInfo} has been processed`);
      process.exit(0);
    }, function(err) {
      logger.error(`Import of ${repoInfo} failed because of ${err}`);
      process.exit(1);
    });

  });

});
