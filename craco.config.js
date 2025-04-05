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
                    normalizeUrl: false,
                    calc: false,
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
