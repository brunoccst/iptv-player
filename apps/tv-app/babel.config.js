// Used by Metro and Jest. Same preset Expo applies by default.
module.exports = function config(api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
