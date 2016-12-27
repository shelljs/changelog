#!/usr/bin/env node
require('shelljs/global');

// Creates a changelog for the current build and puts it in the root
// Commits the changelog if it updated
// Does not push commit

function parseGitUri(uri) {
  return uri.match(/https:..github.com\/([^./]+)\/([^./]+).*/) ||
    uri.match(/git@github.com:(.*)\/(.*)\.git/);
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
