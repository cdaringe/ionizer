# ionizer

Build [electron](atom/electron) compatible modules while working in any version of nodejs.

<img width="100px" height="100px" src="img/ionizer_rounded.png"></img>

[ ![Codeship Status for cdaringe/ionizer](https://codeship.com/projects/f1c1b6b0-7bb1-0133-ed8b-3a9edbaef368/status?branch=master)](https://codeship.com/projects/119677)

## about
your system's version of `nodejs` most likely does _not_ match the version
that [electron](atom/electron) runs behind the scenes.  this can be problematic. dependencies commonly execute build process
whilst installing them.  perhaps you have seen `node-gyp` build [addons](https://nodejs.org/api/addons.html) when installing something via npm?
For example, suppose

- you are developing on nodejs `0.12.7`
- your electron application under the hood runs iojs `2.5.0`
- you install `npm install --save node-sass`
- you `require('node-sass')` into you electron application and run it...
- YOUR APP CRASHES! :(  `node-sass` was built for `0.12.7 (module version 14)`, not for `2.5.0 (module version 44)`
- you run `ionizer -q`, which rebuilds your dependencies to work with your electron version.
- reload your app.  all is zen!

## installation
This package is hosted on [npm](npm/npm).  See the [ionizer package page](https://www.npmjs.com/package/ionizer).

```sh
npm install --save-dev ionizer
```

## basic usage
i recommend installing `electron-prebuilt` into your package for no-brainer rebuilds.
`ionizer` first tests for `electron-prebuilt` in your project and will rebuild with that if present (and if you don't explicitly specify an electron-path). `npm install --save electron-prebuilt`.

whenever you install a new npm package into your electron project, rerun ionizer:

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

if you want to fine tune your rebuilds, try a rebuild script!

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
ionizer.shouldRebuild('/Users/username/ ... /Electron'); // electron path, see node_modules/electron-prebuilt/path.txt
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
as demonstrated above, this package supports two modes:

1. cli mode
1. package mode

the API when consumed as a package does not have a full doc set yet--please see the example above.  the options to `ionizer` are the same to the cli as they are to `ionizer.rebuild` in the library.  those may be found **[here](https://github.com/cdaringe/ionizer/blob/master/lib/cli.js#L21)**.

## note

### beta
ionizer works, but it's in beta.  despite the API not being published formally now,
it _will_ change in 2.0.0.  expect at least new method names.  the CLI options are not anticipated to change @2.0.0.

### fork'n'h4ck3d
ionizer was initially a fork off of [electron-rebuild](electronjs/electronjs-rebuild), so make sure to give those guys a shout out.  this package was created to improve performance, development experience, and add some features.  some dependencies _will build with ionizer_ that _won't build with electron-rebuild_, although windows support is still lacking in ionizer (help requested for add windows support to [squish-squash](https://github.com/cdaringe/squish-squash)).  notable differences between the packages are:

1. more reliable rebuilds.  ionizer runs the _actual_ electron node process when rebuilding packages
1. faster rebuilds.  rather than rebuilding your entire _node_modules_ folder, you can limit the builds to certain packages.  and keep a record/cache of those packages that have already been rebuilt (so as to not redundantly rebuild them)
1. pure es5. no es6 compilation required for backwards compatibility
    1. improves testing, building, & distribution speed
1. faster tests.  network tests are mocked out. once basic resources are cached.

# todo
- [ ] windows support (`squish-squash`)
- [ ] add doc blocks and gen API docs
- [ ] fix test ECONN issue for connecting to local file server
- [ ] support building against global electron (vs. electron-prebuilt or loose binary)
- [ ] general API tidy!

# changelog
1.x - release
2.0.0 - drop `--verbose` in favor of `--log-level=[winston-log-levels]`

[cdaringe.com](http://www.cdaringe.com)
