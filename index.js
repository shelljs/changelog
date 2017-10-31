#!/usr/bin/env node
var assert = require('assert');
require('shelljs-plugin-sleep');
require('shelljs/global');

// Creates a changelog for the current build and puts it in the root
// Commits the changelog if it updated
// Does not push commit

// The maximum number of deletions for updating the changelog should
// be 5 lines. Typically, the "Unreleased" and "Full Changelog" links
// are changed because the version increases.
var MAX_DELETIONS = 5;

// Command line option: --force
// Skips validating the number of deletions in the changelog diff.
var force = (process.argv.indexOf('--force') >= 0);

function parseGitUri(uri) {
  return uri.match(/https:..github.com\/([^./]+)\/([^./]+).*/) ||
    uri.match(/git@github.com:(.*)\/(.*)\.git/);
}

function verifyChangelog() {
  var diff = exec('git diff HEAD CHANGELOG.md').split('\n');
  var changelog = cat('CHANGELOG.md').split('\n');
  if (changelog[changelog.length - 1] === '') changelog.pop();
  var isOneLine = (changelog.length === 1);
  var deletions = diff.filter(function (x) {
    return /^-/.test(x);
  }).length;
  var containsError = false;
  diff.forEach(function (line) {
    if (line.indexOf('Make a POST first') >= 0) containsError = true;
  });
  assert(
    changelog.length > 1,
    'Changelog was reduced to one line, this is an error.'
  );
  assert(
    !containsError,
    'Changelog contains an error message.'
  );
  assert(
    deletions < MAX_DELETIONS,
    'Too many deletions (-' + deletions + '), this is probably an error.\n' +
    'Run with --force to ignore this error.'
  );
}

function revertChanges() {
  exec('git checkout -- .');
}

function run() {
  echo('...generating changelog (be patient)');
  config.silent = true;
  var urls = exec('git remote show -n origin')
      .grep('Push');
  if (!urls) {
    console.error('Unable to find any URLs you can push to');
    process.exit(1);
  }
  var repoInfo = parseGitUri(urls);
  if (!repoInfo) {
    console.error('Unable to parse your git URL');
    process.exit(2);
  }
  var url = 'github-changelog-api.herokuapp.com/' + repoInfo[1] + '/' + repoInfo[2];
  exec('curl -X POST -s "' + url + '"');
  var newLog;
  do {
    sleep(1);
    newLog = exec('curl "' + url + '"');
  } while (newLog.match(/^Working, try again.*/));
  // Now that the contents are valid, we can write this out to disk
  newLog.to('CHANGELOG.md');

  var changelog_was_updated = false;
  exec('git ls-files --exclude-standard --modified --others').split('\n').forEach(function (file) {
    if (file === 'CHANGELOG.md') changelog_was_updated = true;
  });

  if (changelog_was_updated) {
    if (!force) {
      try {
        echo('...verifying changelog');
        verifyChangelog();
      } catch (err) {
        revertChanges();
        console.error(err.message);
        process.exit(1);
      }
    }
    echo('...committing updated changelog');
    var current_user = exec('git config user.name').trimRight();
    config.silent = false;
    exec('git add CHANGELOG.md');
    exec('git commit -m "docs(changelog): updated by ' + current_user + ' [ci skip]"');
    echo('Done.  You can now \'git push\' the updated changelog.');
  } else {
    echo('CHANGELOG.md already up-to-date.');
  }
}

run();
