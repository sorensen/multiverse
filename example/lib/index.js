
exports.one = function(a) {
  return exports.two(a + 1)
}

exports.two = function(a) {
  return exports.three(a + 2)
}

exports.three = function(a) {
  return a + 3
}