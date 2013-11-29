'use strict';

/*!
 * Module dependencies.
 */

var fs = require('fs')
  , toString = Object.prototype.toString

/**
 * Check if filepath is a directory
 *
 * @param {String} file path
 * @return {Boolean} result
 */

exports.isDirectory = function(fpath) {
  return fs.lstatSync(fpath).isDirectory()
}

/**
 * Check if given argument is an object
 *
 * @param {Any} arg to test
 * @return {Boolean} result
 */

exports.isObject = function(obj) {
  return toString.call(obj) === '[object Object]'
}

/**
 * Recursive / deep object extending
 *
 * @param {Object} destination object
 * @param {Object} source object to extend
 * @return {Object} merged object
 */

exports.extend = function(obj, source) {
  for (var prop in source) {
    var val = source[prop]
    obj[prop] = obj[prop] || {}
    obj[prop] = exports.isObject(val) ? exports.extend(obj[prop], val) : val
  }
  return obj
}

/**
 * Recursive / deep object cloning
 *
 * @param {Object|Array} object to clone
 * @return {Object|Array} cloned object
 */

exports.clone = function(source) {
  var obj = {}
  for (var prop in source) {
    var val = source[prop]

    if (exports.isObject(val)) {
      obj[prop] = exports.clone(val)
    } else if (Array.isArray(val)) {
      obj[prop] = val.slice()
    } else {
      obj[prop] = val
    }
  }
  return obj
}