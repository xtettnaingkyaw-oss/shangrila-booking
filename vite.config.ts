import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Emits /precache-manifest.json during production builds so public/sw.js can precache
// every hashed JS/CSS/image chunk for instant (<50ms) offline & no-VPN iOS Home Screen launches.
function generatePrecacheManifestPlugin(): Plugin {
  return {
    name: 'shangrila-precache-manifest',
    apply: 'build',
    generateBundle(_options, bundle) {
      const assets: string[] = [];
      for (const fileName of Object.keys(bundle)) {
        if (fileName.endsWith('.map')) continue;
        if (fileName.startsWith('assets/')) {
          assets.push('/' + fileName);
        }
      }
      const payload = {
        version: String(Date.now()),
        assets
      };
      this.emitFile({
        type: 'asset',
        fileName: 'precache-manifest.json',
        source: JSON.stringify(payload, null, 2)
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), generatePrecacheManifestPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    hmr: false
  }
})
