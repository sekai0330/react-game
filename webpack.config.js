const webpack = require('webpack')
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const CopyPlugin = require('copy-webpack-plugin')
const { InjectManifest } = require('workbox-webpack-plugin')
const PreloadWebpackPlugin = require('@vue/preload-webpack-plugin')
const childProcess = require('child_process')
const crypto = require('crypto')
const fs = require('fs')

const homeUrl = 'https://arcomage.github.io/'

module.exports = (env, argv) => {
  const dev = argv.mode === 'development'
  const local = env.NODE_ENV2 === 'local'
  process.env.NODE_ENV = argv.mode

  const commitTime = new Date(
    Math.floor(
      childProcess
        .execSync('git log -1 --date=unix --format="%ad"')
        .toString()
        .trim(),
    ) * 1000,
  )
    .toISOString()
    .replace(/\.\d+Z$/, '+00:00')

  const ogimageHash = (() => {
    const fileBuffer = fs.readFileSync('./assets/misc/ogimage.jpg')
    const hashSum = crypto.createHash('md4')
    hashSum.update(fileBuffer)
    const hex = hashSum.digest('hex')
    return hex.substring(0, 20)
  })()

  const config = {
    entry: {
      index: './src/index.tsx',
      pwacompat: './node_modules/pwacompat/src/pwacompat.js',
    },
    output: {
      filename: '[name].[contenthash:6].js',
      chunkFilename: '[name].[contenthash:6].js',
      publicPath: dev || local ? '' : homeUrl,
      assetModuleFilename: 'assets/img/[hash].[ext]',
    },
    ...(dev ? { devtool: 'eval-cheap-module-source-map' } : {}),
    devServer: {
      port: 8080,
      open: true,
      client: {
        overlay: {
          errors: true,
          warnings: false,
        },
      },
      // devMiddleware: {
      //   stats: {
      //     errors: true,
      //     warnings: false,
      //     errorDetails: true,
      //   },
      // },
    },
    resolve: {
      extensions: [
        '.ts',
        '.tsx',
        '.js',
        '.jsx',
        '.scss',
        '.sass',
        '.css',
        '.json',
      ],
    },
    module: {
      rules: [
        {
          test: /\.(j|t)sx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'ts-loader',
          },
        },
        {
          test: /\.(s?c|sa)ss$/i,
          use: [
            'style-loader',
            'css-modules-typescript-loader',
            {
              loader: 'css-loader',
              options: {
                sourceMap: dev,
              },
            },
            {
              loader: 'postcss-loader',
              options: {
                sourceMap: dev,
                postcssOptions: {
                  plugins: [
                    'postcss-import',
                    'tailwindcss',
                    'autoprefixer',
                    ...(dev ? [] : ['cssnano']),
                  ],
                },
              },
            },
            {
              loader: 'sass-loader',
              options: {
                sourceMap: dev,
              },
            },
          ],
        },
        {
          test: /\.svg$/i,
          type: 'asset/resource',
          use: 'svgo-loader',
        },
        {
          test: /\.(webp|png|jpe?g|gif|ico)$/i,
          type: 'asset/resource',
        },
        {
          test: /\.(woff|woff2|otf|eot|ttf)$/,
          type: 'asset/resource',
          generator: {
            filename: 'assets/font/[hash].[ext]',
          },
        },
        {
          test: /\.(wav|mp3)$/,
          type: 'asset/resource',
          generator: {
            filename: 'assets/sfx/[hash].[ext]',
          },
        },
      ],
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.APPVERSION': JSON.stringify(
          process.env.npm_package_version,
        ),
        'process.env.ISDEV': JSON.stringify(dev),
      }),
      new ForkTsCheckerWebpackPlugin(),
      new HtmlWebpackPlugin({
        template: './src/index.html.ejs',
        filename: './index.html',
        title: 'ArcoMage HD',
        url: homeUrl,
        pwaManifestJson:
          dev || local ? './manifest.json' : `${homeUrl}manifest.json`,
        faviconSvg: dev || local ? './favicon.svg' : `${homeUrl}favicon.svg`,
        faviconIco: dev || local ? './favicon.ico' : `${homeUrl}favicon.ico`,
        ogImage:
          dev || local
            ? './ogimage.jpg'
            : `${homeUrl}ogimage.jpg?${ogimageHash}`,
        description:
          "Web-based open source HD clone of 3DO and NWC's 2000 card game Arcomage. Desktop or mobile Android iOS. Online or offline PWA. Multiplayer mode available",
        commitTime,
      }),
      new CopyPlugin({
        patterns: [
          {
            from: 'assets/logo/**/*',
            to: '[name][ext]',
            globOptions: {
              ignore: ['**/manifest.template.ts'],
            },
          },
          {
            from: 'assets/misc/**/*',
            to: '[name][ext]',
          },
        ],
      }),
      new PreloadWebpackPlugin({
        rel: 'prefetch',
        include: 'all',
        fileBlacklist: [/\.(?!(mp3$)).*$/],
        as(entry) {
          if (/\.mp3$/.test(entry)) return 'audio'
          return 'script'
        },
      }),
      ...(dev
        ? []
        : [
            new InjectManifest({
              maximumFileSizeToCacheInBytes: 100000000, // 100 MB
              swSrc: './src/service-worker.ts',
              swDest: './service-worker.js', // should also change `.register()` in `src/utils/swreg.ts`
            }),
          ]),
    ],
    optimization: {
      splitChunks: {
        chunks: 'all',
        maxSize: 20000,
      },
    },
  }

  return config
}
