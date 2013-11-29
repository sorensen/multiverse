
var assert = require('assert')
  , ase = assert.strictEqual
  , ade = assert.deepEqual
  , anse = assert.notStrictEqual
  , Multiverse = require('./index')
  , sourceDir = __dirname + '/example'
  , versionDir = __dirname + '/example/versions'


describe('Multiverse', function() {
  var verse = new Multiverse(sourceDir, versionDir, true)

  it('should return all available versions', function() {
    // var v2 = verse.require('./example/lib/index', 'v0.0.2')
    // log(v2)
    var versions = verse.getVersions()
    assert.deepEqual(['v0.0.3', 'v0.0.2', 'v0.0.1'], versions)
  })

  it('should find a compatible version', function() {
    ase('v0.0.1', verse.findVersion('0.0.1'))
    ase('v0.0.2', verse.findVersion('0.0.2'))
    ase('v0.0.3', verse.findVersion('0.0.*'))
    ase('v0.0.3', verse.findVersion('0.*'))
  })

  it('should build export trees', function() {
    var v1 = verse.getVersionTree('0.0.1')
      , raw = require('./example/versions/v0.0.1/lib/index')
      , test = verse.require('./example/lib/index', 'v0.0.1')

    ase(v1.lib.index.one.toString(), raw.one.toString(), test.one.toString())
    ase(v1.lib.index.one, raw.one)
    ase(test.one, raw.one)
    ade(test, raw)
  })

  it('should throw errors correctly', function() {
    var v3 = verse.require('./example/lib/index', 'v0.0.3')

    assert.throws(function() {
      v3.error()
    }, Error)
  })

  it('should have the correct methods', function() {
    var v0 = require('./example/lib/index')
    var v1 = verse.require('./example/lib/index', 'v0.0.1')
    var v2 = verse.require('./example/lib/index', 'v0.0.2')
    var v3 = verse.require('./example/lib/index', 'v0.0.3')

    ase(7, v0.one(1))
    ase('223', v1.one(1))
    ase(7, v2.one(1))
    ase(7, v3.one(1))
  })

  it('should work for singleton classes', function() {
    var v0 = require('./example/lib/singleton')
    var v3 = verse.require('./example/lib/singleton', 'v0.0.3')

    ase(undefined, v0.prop)
    ase('the single ladies', v0.all)
    ase('the single ladies', v3.all)

    ase('v0.0.3', v3.prop)
    ase('cat', v3.meow())
  })
})

function log() {
  Array.prototype.slice.call(arguments).forEach(function(arg) {
    if (typeof arg === 'function') arg = arg.toString()
    console.log('\n', require('util').inspect(arg, false, null, true), '\n')
  })
}