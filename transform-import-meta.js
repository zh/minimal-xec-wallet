// Custom browserify transform to handle import.meta.url
const through = require('through2');

module.exports = function(file) {
  return through(function(chunk, enc, callback) {
    const code = chunk.toString();
    
    // Replace import.meta.url with a browser-compatible alternative
    const transformed = code.replace(
      /new URL\(['"`]([^'"`]+)['"`],\s*import\.meta\.url\)/g,
      function(match, filename) {
        // For WASM files, we'll use a data URL or return null
        if (filename.endsWith('.wasm')) {
          return 'null /* WASM file excluded for browser compatibility */';
        }
        return `new URL('${filename}', window.location.origin)`;
      }
    );
    
    this.push(transformed);
    callback();
  });
};