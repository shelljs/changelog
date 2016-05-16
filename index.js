#!/usr/bin/env node
require('shelljs/global');

// Creates a changelog for the current build and puts it in the root
// Commits the changelog if it updated
// Does not push commit

function run() {
  echo('...generating changelog (be patient)');

  config.silent = true;
  exec('curl -X POST -s "github-changelog-api.herokuapp.com/shelljs/shx"').to('CHANGELOG.md');

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
