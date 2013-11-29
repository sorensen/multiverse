
function Foo() {
  this.bar = 20
}

Foo.prototype.one = function() {
  this.bar += 1
  console.log('lib.one')
  return this.two()
}

Foo.prototype.two = function() {
  this.bar += 2
  console.log('lib.two')
  return this.three()
}

Foo.prototype.three = function() {
  this.bar += 3
  console.log('lib.three')
  return this
}

module.exports = Foo
