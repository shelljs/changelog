#!/usr/bin/env node
var assert = require('assert');
require('shelljs-plugin-sleep');
var shell = require('shelljs');

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
  var diffStr = shell.exec('git diff HEAD CHANGELOG.md');
  var diff = diffStr.split('\n');
  var changelog = shell.cat('CHANGELOG.md').split('\n');
  if (changelog[changelog.length - 1] === '') changelog.pop();
  var isOneLine = (changelog.length === 1);
  var deletions = diff.filter(function (x) {
    return /^-/.test(x);
  }).length;
  var containsError = false;
  diff.forEach(function (line) {
    if (line.indexOf('Make a POST first') >= 0
        && line.indexOf('https://github.com/shelljs/changelog/issues/1') < 0) {
      // If the changelog output is telling us to make a POST request, it's
      // probably a bug in the script. Unless the changelog is for the
      // shelljs/changelog project itself and is referring to GitHub issue #1,
      // which was a bug report for that issue, and has since been fixed.
      containsError = true;
    }
  });
  assert(
    changelog.length > 1,
    'Changelog was reduced to one line, this is an error.'
  );
  if (containsError) {
    console.error('Error message for changelog:');
    console.error(diffStr.toString());
  }
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
  shell.exec('git checkout -- .');
}

function run() {
  shell.echo('...generating changelog (be patient)');
  shell.config.silent = true;
  var urls = shell.exec('git remote show -n origin')
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
  shell.exec('curl -X POST -s "' + url + '"');
  var newLog;
  do {
    shell.sleep(1);
    newLog = shell.exec('curl "' + url + '"');
  } while (newLog.match(/^Working, try again.*/));
  // Now that the contents are valid, we can write this out to disk
  newLog.to('CHANGELOG.md');

  var changelog_was_updated = false;
  shell.exec('git ls-files --exclude-standard --modified --others').split('\n').forEach(function (file) {
    if (file === 'CHANGELOG.md') changelog_was_updated = true;
  });

  if (changelog_was_updated) {
    if (!force) {
      try {
        shell.echo('...verifying changelog');
        verifyChangelog();
      } catch (err) {
        revertChanges();
        console.error(err.message);
        process.exit(1);
      }
    }
    shell.echo('...committing updated changelog');
    var current_user = shell.exec('git config user.name').trimRight();
    shell.config.silent = false;
    shell.exec('git add CHANGELOG.md');
    shell.exec('git commit -m "docs(changelog): updated by ' + current_user + ' [ci skip]"');
    shell.echo('Done.  You can now \'git push\' the updated changelog.');
  } else {
    shell.echo('CHANGELOG.md already up-to-date.');
  }
}

run();
