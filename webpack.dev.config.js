const webpack = require('webpack');
const fs = require('fs');
const path = require('path');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json')));

const banner =
`${pkg.title} ${pkg.version} <${pkg.homepage}>
Copyright (c) ${(new Date()).getFullYear()} ${pkg.author.name} <${pkg.author.url}>
Released under ${pkg.license} License`;

const plugins = [
  new webpack.DefinePlugin({
      '__DEV__': true,
      '__VERSION__': JSON.stringify(pkg.version)
  }),
  new webpack.BannerPlugin(banner)
];

const modules = {
  rules: [
    {
      test: /\.m?js$/,
      exclude: /node_modules/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env', '@babel/preset-flow'],
          plugins: ['@babel/plugin-proposal-class-properties']
        }
      }
    }
  ]
}

module.exports = [
  {
    mode: 'production',
    entry: './src/index.js',
    output: {
      filename: 'storago.min.js',
      path: path.resolve(__dirname, 'dist'),
      library: 'storago',
      libraryTarget: 'umd',
    },
    plugins: plugins.concat([
      new UglifyJSPlugin(),
    ]),
    module: modules,
  },
  {
    mode: 'development',
    entry: './src/index.js',
    output: {
      filename: 'storago.js',
      path: path.resolve(__dirname, 'dist'),
      library: 'storago',
      libraryTarget: 'umd',
    },
    plugins: plugins,
    module: modules,
  }
];
