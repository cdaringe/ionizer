# ionizer

Build [electron](atom/electron) compatible modules while working in any version of nodejs.

## why

Dependencies commonly have a build process that executes when installing them.  Perhaps you've seen `node-gyp` when installing something?  Some packages even require that they be compiled against specific versions of nodejs.  For exampple, if you are developing on nodejs `0.12.7`, but your electron application under the hood runs iojs `2.5.0`, the compiled module may have hard links against the `0.12.7` installation.  Therefore, if your electron application tries to run them, it will error out!  To alleviate, you must build your modules against the anticipated runtime, which is `2.5.0`.  Ionizer helps do this.

## install
Install the package with `--save-dev`:

```sh
npm install --save-dev ionizer
```


## usage
Whenever you install a new npm package into your electron project, rerun ionizer:

```sh
./node_modules/.bin/ionizer # [options]
```

The recommended rebuild strategy is to use npm scripts and a build file:

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
var fs = require('fs');
var path = require('path');
var pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
var pkgElectronPrebuiltVersion = pkg.devDependencies['electron-prebuilt']; // or a version, eg '0.30.6'
var electronPrebuiltVersion = pkgElectronPrebuiltVersion.match(/\d+\.\d+\.\d+$/)[0];
var ionizer = require('ionizer');

if (electronPrebuiltVersion !== pkgElectronPrebuiltVersion) {
    throw new TypeError([
        'electron-prebuilt needs to be a fixed version.',
        'package.json:', pkgElectronPrebuiltVersion,
        'parsed version:', electronPrebuiltVersion
    ].join(' '));
}


ionizer.shouldRebuild(path.resolve('./node_modules/electron-prebuilt/dist/'))
.then(function(shouldBuild) {
    if (!shouldBuild) { return true; }
    return ionizer.installNodeHeaders(electronPrebuiltVersion)
})
.then(function() {
    return ionizer.rebuildNativeModules({
        nodeVersion: electronPrebuiltVersion,
        nodeModulesPath: './node_modules',
        quick: true,
        ignore: ['react', 'redux']
    });
});
.catch(function(err) {
    console.error(err.message);
});

```

As demonstrated above, this package supports two modes:

1. CLI mode
1. package mode


### options
See [src/cli.js](src/cli.js) to see the available cli options to configure your rebuild.

##### quick builds `quick`
The `-q` flag will maintain a list of what packages have been built against a
target version, and only rebuild those modules that are not currently built
against it.

##### ignore modules to rebuild `ignore`
When using this module programatically, you can add `ignore: ['array', 'of', 'package', names]`
when calling `rebuildNativeModules` to _not_ rebuild those modules.  This feature
_must be used in conjuction with quick mode_, or is ignored.

### build process integration

ionizer is also a library that you can just require into your app or build process (e.g. grunt/gulp/etc) as described above.  Check out the [API docs]()

```js
import { installNodeHeaders, rebuildNativeModules, shouldRebuild } from 'ionizer';
let shouldBuild = shouldRebuild('/path/to/Electron');
let headerResult = installNodeHeaders('v0.25.0');
headerResult.then(() => rebuildNativeModules('v0.25.0', './node_modules'));
```

## note
ionizer was initially a fork off of [shouldRebuild](electronjs/electronjs-rebuild), so make sure to give those guys a shout out.
this package was created to improve performance and the development experience.  Notable differences between the packages are:

1. less dependencies
1. uses pure es5. no es6 compilation
  1. makes testing, building, & distribution slower, cumbersome (subjective, I know)
1. (faster tests)[https://github.com/electronjs/electron-rebuild/pull/28/files#r42517350], and a perf conscious mindset (not a jab, FTR)

# todo
- [ ] drop `mocha`, add `tape`
- [ ] mock out network tests
- [ ] remove all es6, revert to es5 to dodge the build step
- [ ] precommit-hook for lint, format, test
- [ ] simplify method names
- [ ] purge test artifacts
