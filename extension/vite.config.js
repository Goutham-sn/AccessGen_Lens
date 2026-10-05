import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { resolve } from 'path'

// Each entry becomes a self-contained IIFE bundle (content scripts cannot
// use ES module imports at runtime).
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: {
        'service-worker': resolve(__dirname, 'background/service-worker.js'),
        bridge: resolve(__dirname, 'content-scripts/bridge.js'),
        'simulation-controller': resolve(__dirname, 'content-scripts/simulation-controller.js'),
        recorder: resolve(__dirname, 'content-scripts/recorder.js'),
        popup: resolve(__dirname, 'popup/popup.js'),
        offscreen: resolve(__dirname, 'offscreen/offscreen.js')
      },
      output: {
        // Rollup refuses format:'iife' outright for a build with multiple
        // entry points ("UMD and IIFE output formats are not supported for
        // code-splitting builds"), even though none of our 5 entries
        // actually share code. So we stay on 'es' and wrap the compiled
        // TEXT of each chunk in an IIFE via intro/outro instead. This
        // still wraps the entire bundle — including every module pulled
        // in via import (communicator.js, ControlPanel.js, every profile
        // class) — in one function scope. That matters because per-file
        // manual IIFE wraps in the *source* only protect that one file's
        // own top-level code; Rollup hoists imported modules' top-level
        // `let`/`const`/`class` above them in the compiled output. Those
        // hoisted bindings collided across repeated injections of the same
        // content script, throwing "Identifier has already been declared".
        format: 'es',
        intro: '(function(){',
        outro: '})();',
        entryFileNames: (chunk) => {
          const map = {
            'service-worker': 'background/service-worker.js',
            bridge: 'content-scripts/bridge.js',
            'simulation-controller': 'content-scripts/simulation-controller.js',
            recorder: 'content-scripts/recorder.js',
            popup: 'popup/popup.js',
            offscreen: 'offscreen/offscreen.js'
          }
          return map[chunk.name] || '[name].js'
        },
        // Bundle everything into each entry — no shared chunks, since
        // content scripts are injected as single classic scripts.
        inlineDynamicImports: false,
        manualChunks: () => null
      }
    }
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
        { src: 'popup/popup.html', dest: 'popup' },
        { src: 'popup/popup.css', dest: 'popup' },
        { src: 'offscreen/offscreen.html', dest: 'offscreen' },
        { src: 'icons/*', dest: 'icons' }
      ]
    })
  ]
})
