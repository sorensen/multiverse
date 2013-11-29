
function Single() {
  this.all = 'the single ladies'
}

Single.something = function() {
  return 20
}

Single.prototype.another = function() {
  return 'hi'
}

module.exports = new Single()