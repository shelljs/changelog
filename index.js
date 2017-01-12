#!/usr/bin/env node
require('shelljs/global');

// Creates a changelog for the current build and puts it in the root
// Commits the changelog if it updated
// Does not push commit

function parseGitUri(uri) {
  return uri.match(/https:..github.com\/([^./]+)\/([^./]+).*/) ||
    uri.match(/git@github.com:(.*)\/(.*)\.git/);
}

function verifyChangelog() {
  var changelog = exec('git diff HEAD~1');
  var lines = changelog.split('\n');
  var isOneLine = (lines.length === 1);
  var deletions = 0;
  var containsErrorMessage = false;
  lines.filter(function (line) {
    if (/^-/.test(line)) deletions++;
    if (line.indexOf('Make a POST first') >= 0) containsErrorMessage = true;
  });
  if (isOneLine) {
    revertChanges();
    console.error('Changelog diff should be more than 1 line long');
    process.exit(3);
  }
  if (deletions > 10) {
    revertChanges();
    console.error('Too many deletions (-' + deletions + '), verify that the changes to CHANGELOG.md are correct');
    process.exit(4);
  }
  if (containsErrorMessage) {
    revertChanges();
    console.error('Changelog contains an error message');
    process.exit(5);
  }
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
    exec('sleep 1');
    newLog = exec('curl "' + url + '"');
  } while (newLog.match(/^Working, try again.*/));
  // Now that the contents are valid, we can write this out to disk
  newLog.to('CHANGELOG.md');

  var changelog_was_updated = false;
  exec('git ls-files --exclude-standard --modified --others').split('\n').forEach(function (file) {
    if ( file === 'CHANGELOG.md') changelog_was_updated = true;
  });

  if (changelog_was_updated) {
    echo('...verifying changelog');
    verifyChangelog();
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
