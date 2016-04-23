'use strict';

const cp = require('child_process');
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const spawn = require('./spawn.js');
const _ = require('lodash');

const exp = {
  getPath: function() {
    // memoized post-bind
    var epbpath = path.resolve(process.cwd(), './node_modules', 'electron-prebuilt', 'path.txt');
    var ePath;
    try {
        ePath = fs.readFileSync(epbpath, 'utf8');
        return path.resolve.apply(null, [ process.cwd(), './node_modules', 'electron-prebuilt', ePath ]);
    } catch (err) {
        // no prebuilt found
        winston.warn([
            'no electron-prebuilt found, attempting to build against',
            'global electron'
        ].join(' '));
    }
    try {
        ePath = cp.spawnSync('which', ['electron']).stdout.toString().match(/.*[a-zA-Z]/)[0];
    } catch (err) {
        winston.error('no local or global electron found');
        process.exit(1);
    }
    return path.resolve(ePath);
  },

  version: function(electronPath) {
    // memoized post-bind
    if (!electronPath) electronPath = this.getPath();
    const result = cp.spawnSync(electronPath, [ '--version' ]);
    const ver = result.stdout.toString().replace(/\n/g, '');
    const matches = ver.match(/^v\d+\.\d+\.\d+/);
    if (!matches || !matches[0]) { // eg v0.35.4
      throw new Error(`could not extract version from ${electronPath}`);
    }
    return matches[0].replace('v', '');
  },

  moduleVersion: function(electronPath) {
    const ePath = typeof electronPath === 'object' ? electronPath.electronPath : electronPath;
    const args = [ '-e', 'console.log(process.versions.modules)' ];
    const env = { ATOM_SHELL_INTERNAL_RUN_AS_NODE: '1' };
    if (!ePath) throw new ReferenceError('missing `electronPath`');
    const result = cp.spawnSync(ePath, args, { env: env });
    const ver = (result.stdout + result.stderr).replace(/\n/g, '');
    const matches = ver.match(/^\d+$/);
    if (!matches || !matches[0]) {
      throw new Error(`unable to extract electron modules version #`);
    }
    return matches[0];
  },

};

exp.getPath = _.bind(exp.getPath, exp);
exp.getPath = _.memoize(exp.getPath);
exp.version = _.bind(exp.version, exp);
exp.version = _.memoize(exp.version);
module.exports = exp;
