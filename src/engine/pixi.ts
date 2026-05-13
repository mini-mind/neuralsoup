// Single runtime/type entrypoint for all Pixi usage in the app.
// This avoids mixing constructors and extension registration across
// `pixi.js` and `pixi.js-legacy`.
export * from 'pixi.js-legacy';
