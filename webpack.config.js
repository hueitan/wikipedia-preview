const webpack = require('webpack')
const childProcess = require('child_process')
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const IgnoreEmitPlugin = require('ignore-emit-webpack-plugin');
const LessPluginInlineSvg = require('less-plugin-inline-svg');
const StylelintPlugin = require('stylelint-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const fs = require('fs');
const path = require('path');
const CryptoJS = require("crypto-js");

// This is a less plugin to build cache-busting wikipedia urls
class WikipediaImage {
    install(less) {
      less.functions.functionRegistry.add(
        'wikipedia-image', function (fileArg, iconIdArg, svgArgs) {
          const { IMAGE_PATH } = process.env
          const { value } = fileArg;

          if ( IMAGE_PATH ) {
            const fileUrl = `${IMAGE_PATH}/${value}`
            const fileContent = fs.readFileSync('./images/' + value).toString()
            const hash = CryptoJS.MD5(fileContent).toString().slice(0, 5)
            const fullUrl = `${fileUrl}?${hash}`;
            return new (less.tree.Quoted)( '"', "url('" + fullUrl + "')" );
          } else {
            const inlineSvg = less.functions.functionRegistry.get('inline-svg').bind(this)
            return inlineSvg( { value: `../images/${value}` }, iconIdArg, svgArgs)
          }
        }
      )
    }
}

const config = {
  entry: {
    'wikipedia-preview': './src/index.js',
    'default-link-style': './src/linkStyle.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '(SET AT THE BOTTOM OF THIS FILE)',
    library: 'wikipediaPreview',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  devServer: {
    contentBase: [ path.join(__dirname, 'demo'), path.join(__dirname, 'dist') ],
    watchOptions: {
      ignored: ['dist', 'node_modules']
    }
  },
  plugins: [
      new StylelintPlugin({
        context: './style/',
        files: '*.less',
        fix: true
      }),
      new MiniCssExtractPlugin({
        filename: 'wikipedia-preview.css'
      }),
      new IgnoreEmitPlugin(['default-link-style.production.js', 'default-link-style.development.js']),
      new CompressionPlugin(),
      new BundleAnalyzerPlugin({
        analyzerMode: 'disabled',
        generateStatsFile: true
      }),
      new webpack.DefinePlugin({
        APP_VERSION: JSON.stringify(JSON.parse(fs.readFileSync('./package.json')).version),
        GIT_HASH: JSON.stringify(childProcess.execSync('git rev-parse --short HEAD').toString().trim())
      }),
    ],
  module: {
    rules: [
      {
        enforce: 'pre',
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'eslint-loader',
        options: {
          fix: true
        }
      },
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
                [
                  '@babel/preset-env',
                  {
                    targets: 'defaults'
                  }
                ]
              ]
          }
        }
      },
      {
        test: /\.less$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'less-loader', options: {
              sourceMap: true,
              plugins:
              [
                new LessPluginInlineSvg({ base64: true }),
                new WikipediaImage()
              ]
            }
          },
        ]
      },
      {
        test: /link.less$/i,
        use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
            {
              loader: 'less-loader', options: {
                sourceMap: true,
                plugins:
                [
                  new LessPluginInlineSvg({ base64: true }),
                  new WikipediaImage()
                ]
              }
            },
          ],
      },
    ]
  }
};
module.exports = (env, argv) => {
  config.output.filename = '[name].' + argv.mode + '.js';
  return config;
};