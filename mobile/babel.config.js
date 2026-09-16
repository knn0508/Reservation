// babel-preset-expo already wires up expo-router and the React Native JSX runtime;
// nothing else is needed until a library asks for its own plugin.
module.exports = function (api) {
  api.cache(true)
  return { presets: ["babel-preset-expo"] }
}
