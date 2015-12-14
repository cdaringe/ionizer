# ionizer

Build [electron](atom/electron) compatible modules while working in any version of nodejs.

<img width="100px" height="100px" src="img/ionizer_rounded.png"></img>

[ ![Codeship Status for cdaringe/ionizer](https://codeship.com/projects/f1c1b6b0-7bb1-0133-ed8b-3a9edbaef368/status?branch=master)](https://codeship.com/projects/119677)

## about
Your system's version of `nodejs` most likely does _not_ match the version
that [electron](atom/electron) runs behind the scenes.  This can be problematic. Dependencies commonly execute build process
whilst installing them.  Perhaps you have seen `node-gyp` build [addons](https://nodejs.org/api/addons.html) when installing something via npm?
For example, suppose

- you are developing on nodejs `0.12.7`
- your electron application under the hood runs iojs `2.5.0`
- you install `npm install --save node-sass`
- you `require('node-sass')` into you electron application and run it...
- YOUR APP CRASHES! :(  `node-sass` was built for `0.12.7 (module version 14)`, not for `2.5.0 (module version 44)`
- you run `ionizer -q`, and reload your app.  All is zen!

## installation
```sh
npm install --save-dev ionizer
```

## basic usage
I recommend installing `electron-prebuilt` into your package for no-brainer rebuilds, and using that version controlled binary for development if you can!  `ionizer` first tests for `electron-prebuilt` in your project and will rebuild to be compatible with that. `npm install --save electron-prebuilt`.

Whenever you install a new npm package into your electron project, rerun ionizer:

```json2
// package.json
{
    ...
    scripts: {
        "postinstall": "ionizer -q", // or ...
        "postinstall": "ionizer -q --limit=leveldown,some-pkg",
    }
}
```

If you want to fine tune your rebuilds, try a rebuild script!

```json
// inside your package.json
...
  "scripts": {
      "postinstall": "node .ionizer.js"
  }
...
```

```js
// .ionizer.js
// advanced rebuilding (see simpler package.json example above)
var fs = require('fs');
var path = require('path');
var pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
var _ = require('lodash');
var electronVersion = _.get(pkg, 'dependencies.electron-prebuilt') || _.get(pkg, 'electron-version');
electronVersion = electronVersion.match(/\d+\.\d+\.\d+$/)[0];
var ionizer = require('ionizer');
ionizer.setLogLevel('verbose');

// test if rebuilding necessary
ionizer.shouldRebuild('/Users/username/ ... /Electron'); // electron path, see ]
.then(function(rslt) {
    if (!rslt.shouldRebuild) { process.exit(0); }
    return ionizer.installNodeHeaders(electronVersion)
    .then(function initRebuild() {
        return ionizer.rebuild({
            electronVersion: electronVersion,
            modulesDir: './node_modules',
            quick: true,
            ignore: ['webpack', 'babel', 'react', 'redux', 'pouchy']
        });
    });
})
.catch(function(err) {
    console.error(err.message);
});

```

## options
As demonstrated above, this package supports two modes:

1. CLI mode
1. package mode

The API while using as a package does not have a full doc set yet--please see the example above.  The options to `ionizer` are the same to the CLI as they are to `ionizer.rebuild` in the library.  Those may be found **[here](https://github.com/cdaringe/ionizer/blob/master/lib/cli.js#L21)**.

## note

### beta
ionizer works, but it's in beta.  despite the API not being published formally now,
it _will_ change in 2.0.0.  expect at least new method names.  the CLI options are not anticipated to change @2.0.0.

### fork'n'h4ck3d
ionizer was initially a fork off of [shouldRebuild](electronjs/electronjs-rebuild), so make sure to give those guys a shout out.  this package was created to improve performance, development experience, and add some features.  Some dependencies _will build with ionizer_ that _won't build with electron-rebuild_, although windows support is still lacking in ionizer (help requested for `squish-squash` windows support!).  Notable differences between the packages are:

1. more reliable rebuilds.  ionizer runs the _actual_ electron node process when rebuilding packages
1. faster rebuilds.  rather than rebuilding your entire node_modules, you can limit the builds to certain packages, and keep a record/cache of those packages that have already been rebuilt (so as to not redundantly rebuild them).
1. pure es5. no es6 compilation required for backwards compatibility
  1. improves testing, building, & distribution speed
1. faster tests.  network tests are mocked out. once basic resources are cached.

# todo
- [ ] windows support (`squash-squash`)
- [ ] support building against global electron (vs. electron-prebuilt or loose binary)
- [ ] add doc blocks and gen API docs
- [ ] precommit-hook for lint, format, test
- [ ] simplify method names
- [ ] purge test artifacts
- [ ] general API tidy!

[cdaringe.com](http://www.cdaringe.com)
