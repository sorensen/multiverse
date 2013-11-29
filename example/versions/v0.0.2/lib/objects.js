
Foo.prototype.two = function() {
  this.bar *= 2
  console.log('v0.0.2.two')
  return this.three()
}
