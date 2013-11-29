'use strict';

/*!
 * Module dependencies.
 */

var fs = require('fs')
  , path = require('path')
  , vm = require('vm')
  , semver = require('semver')
  , uglify = require('uglify-js')
  , utils = require('./utils')
  , info = require('../package.json')
  , debug = require('debug')(info.name)
  , log

/**
 *
 *
 *
 */

function Multiverse(source, target, autoBuild) {
  this.sourceDir = source
  this.targetDir = target
  this.__tree = {}
  debug('created for source: `%s` and target: `%s`', source, target)
  autoBuild && this.build()
}

/**
 * Get relative path of file, normalizing source and target directories
 *
 * @param {String} file path
 * @return {String} normalized path
 */

Multiverse.prototype.getRelativePath = function(fpath) {
  return fpath
    .replace(this.targetDir, '')
    .split('/')
    .slice(2)
    .join('/')
}

/**
 * Get the base / source path for a given file
 *
 * @param {String} file path
 * @return {String} base file path
 */

Multiverse.prototype.getBasePath = function(fpath) {
  return path.join(this.sourceDir, this.getRelativePath(fpath))
}

/**
 * TODO: determine if using uglify to combine modules is OK...
 *
 * Build a new version of a given file path combining the source file 
 * and the versioned file
 *
 * @param {String} file path
 * @return {Object} new module exports
 */

Multiverse.prototype.buildFile = function(fpath) {
  var basePath = this.getBasePath(fpath)
    , src = fs.readFileSync(basePath, 'utf-8') + ';\n;' + fs.readFileSync(fpath, 'utf-8')
  
  var code = uglify.parse(src, { 
    filename: fpath 
  , minify: false
  , fromString: true
  , compress: false
  })

  code.figure_out_scope()
  // exp = Multiverse.requireString(src, fpath)
  return Multiverse.requireString(code.print_to_string(), fpath)
}

/**
 * Walk through the given directory and build an exports tree
 *
 * @param {String} directory path
 * @param {Object} options for filtering / exports iterator
 * @return {Object} exports tree
 */

Multiverse.prototype.tree = function(dir, options) {
  var x = {}
    , self = this
  
  options || (options = {})

  fs.readdirSync(dir).forEach(function(file) {
    var fpath = path.join(dir, file)
      , ext = path.extname(file)
      , name = path.basename(file, ext)
      , isDir = utils.isDirectory(fpath)
      , exp

    // If a filter was provided, check that the file is valid
    if (options.filter && !options.filter(file, fpath, isDir)) {
      return
    }

    // Directory recursion
    if (isDir) {
      x[file] = self.tree(fpath, options)
      if (x[file].hasOwnProperty('__path')) {
        debug('warning: `__path` property collision for `%s`', fpath)
      }
      x[file].__path = fpath
      return
    }

    // Check if we are within the target version directory
    if (~dir.indexOf(self.targetDir)) {
      exp = self.buildFile(fpath)
    } else {
      exp = require(fpath)
    }

    // If an iterator was passed, use it to transform the found exports
    x[name] = options.iterator ? options.iterator(name, fpath, exp) : exp
    if (x[name].hasOwnProperty('__path')) {
      debug('warning: `__path` property collision for `%s`', fpath)
    }
    x[name].__path = fpath
  })
  return x
}

/**
 * Create a sandboxed virtual module representing the given file path
 * and exports object provided
 *
 * @param {String} filePath Absolute path to module (file to load)
 * @param {Object} mocks Hash of mocked dependencies
 * @param {Any} specific module exports
 * @return {Object} created module context
 */

Multiverse.requireVirtual = function(filePath, mocks, exp) {
  mocks || (mocks = {})
  exp || (exp = {})

  // this is necessary to allow relative path modules within loaded file
  // i.e. requiring ./some inside file /a/b.js needs to be resolved to /a/some
  function resolve(name) {
    if (name.charAt(0) !== '.') return name
    return path.resolve(path.dirname(filePath), name)
  }
  var context = {
    require: function(name) {
      return mocks[name] || require(resolve(name))
    }
  , console: console
  , exports: exp
  , module: { exports: exp }
  }
  vm.runInNewContext(fs.readFileSync(filePath), context)
  return context
}

/**
 * Build the multiverse for the current source and target directories, creates 
 * a clone of the source exports for each available version, extending it with 
 * the version specific exports, this will also stub out all require paths for 
 * each version for files that exist in the source but not the version
 *
 * @param {Object} tree options for base / source directory
 * @param {Object} tree options for version directory
 * @return {Object} version export tree
 */

Multiverse.prototype.build = function(baseOpts, versionOpts) {
  var self = this
  debug('building tree')

  baseOpts || (baseOpts = {})
  versionOpts || (versionOpts = {})

  // Create an object tree of the base code from exports
  var original = this.tree(this.sourceDir, utils.extend({
    filter: function(name, fpath, isDir) {
      return fpath !== self.targetDir
    }
  }, baseOpts))

  // Create an object tree for all found versions of the code
  var versions = this.tree(this.targetDir, versionOpts)

  // Fill in the object tree from the original exported code
  for (var v in versions) {
    versions[v] = utils.extend(utils.clone(original), versions[v])
  }

  // Build the require cache
  function buildCache(source, v) {
    for (var prop in source) {
      var obj = source[prop]
        , fpath = obj.__path
        , opath

      if (!fpath) {
        continue
      }

      if (!~fpath.indexOf(self.targetDir) && v) {
        opath = fpath
        fpath = fpath.replace(self.sourceDir, path.join(self.targetDir, v))
      }

      if (~fpath.indexOf('.js')) {
        try {
          // Since the filepath may not exist in the current version, use the 
          // original filepath, cache the virtual module in require for later use
          require.cache[fpath] = Multiverse.requireVirtual(opath || fpath, null, obj)
          source[prop] = require.cache[fpath].exports
        } catch (e) { 
          debug('error loading %s', fpath) 
        }
      } else if (utils.isObject(obj)) {
        buildCache(obj, v || prop)
      }
    }
  }

  // Cleanup all extra properties created during build
  function clean(obj) {
    for (var prop in obj) {
      delete obj[prop].__path
      utils.isObject(obj[prop]) && clean(obj[prop])
    }
  }

  buildCache(versions)
  clean(versions)
  debug('build completed for `%s`', Object.keys(versions).join(', '))
  this.__tree = versions
  return this.__tree
}

/**
 * NOTE: this should probably be removed or log warning, the tree 
 * that is built internally may not be the same as the original exports
 *
 * Get the built export tree for the requested version
 *
 * @param {String} version
 * @return {Object} export tree
 */

Multiverse.prototype.getVersionTree = function(version) {
  var v = this.findVersion(version)
  return v ? this.__tree[v] : this.__tree.original
}

/**
 * Find an available version that satisfies supplied version
 *
 * @param {String} version
 * @return {String|Boolean} matching version
 */

Multiverse.prototype.findVersion = function(version) {
  return version ? this.getVersions().filter(function(x) {
    return semver.satisfies(x, version)
  })[0] : false
}

/**
 * Get all available versions
 *
 * @return {Array} available versions
 */

Multiverse.prototype.getVersions = function() {
  return Object.keys(this.__tree).sort(semver.rcompare)
}

/**
 * Require a file / module matching an available version
 *
 * @param {String} file path to base file
 * @param {String} version
 * @return {Object} module exports
 */

Multiverse.prototype.require = 
Multiverse.prototype.requireVersion = function(fpath, version) {
  var v = this.findVersion(version)
    , caller = getCallFile()
    , dirname = path.dirname(caller)
    , oPath = path.resolve(dirname, fpath)
    , target = path.join(this.targetDir, v)
    , vPath = oPath.replace(this.sourceDir, target)
    , cache = require.cache[vPath] || require.cache[vPath + '.js']

  return cache ? cache.exports : require(vPath)
}

/**
 * Create a module from a string of code
 *
 * @param {String} source / code
 * @param {String} filename
 * @return {Object} resulting exports from code
 */

Multiverse.requireString = function(src, filename) {
  var Module = module.constructor
    , m = new Module()

  m._compile(src, filename)
  return m.exports
}

/**
 * General logging helper
 */

log =
Multiverse.log = 
Multiverse.prototype.log = function() {
  Array.prototype.slice.call(arguments).forEach(function(arg) {
    if (typeof arg === 'function') arg = arg.toString()
    debug('\n', require('util').inspect(arg, false, null, true), '\n')
  })
}

/**
 * Get filename of calling function
 *
 * @return {String} filename
 */

function getCallFile() {
  try {
    var err = new Error()
      , callerfile
      , currentfile

    err.prepareStackTrace = function(err, stack) {
      return stack
    }
    currentfile = err.stack.shift().getFileName()

    while (err.stack.length) {
      callerfile = err.stack.shift().getFileName()
      if (currentfile !== callerfile) {
        return callerfile
      }
    }
  } catch (e) {}
  return undefined
}

/*!
 * Module exports.
 */

module.exports = Multiverse
