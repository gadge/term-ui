const candidates = [
  [ '1', 2, '3' ],
  [ 1, '2', '3' ],
  [ 'foo' ],
  []
]

for (let vec of candidates) {
  const joined = vec.join(';')
  console.log(typeof joined, joined.length, '(' + vec.join(';') + ')')
}