// craco.config.js

const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.optimization.minimizer =
        webpackConfig.optimization.minimizer.map((plugin) => {
          if (plugin.constructor.name === 'CssMinimizerPlugin') {
            return new CssMinimizerPlugin({
              parallel: true,
              minimizerOptions: {
                preset: [
                  'default',
                  {
                    discardComments: { removeAll: true },
                    normalizeUrl: true, // URL 정규화 활성화
                    calc: true, // calc() 최적화 활성화
                  },
                ],
              },
            });
          }
          return plugin;
        });

      return webpackConfig;
    },
  },
};