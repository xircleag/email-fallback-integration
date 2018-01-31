const path = require('path')

module.exports = {
  context: __dirname,
  entry: './src/handlers.js',
  target: 'node',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    library: 'index',
    libraryTarget: 'commonjs2'
  },
  node: {
    fs: 'empty',
    net: 'empty',
    tls: 'empty',
    __filename: false,
    __dirname: false
  },
  module: {
    loaders: [
      {test: /\.json$/, loader: 'json-loader'},
      {test: /\.js$/, loader: 'transform-loader?brfs'}
    ]
  }
}
