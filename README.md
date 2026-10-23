# RADAR PRO

Canli altin ve doviz terminali.

## Tek link (Cloudflare Worker)

1. Bu repoya `altin-fiyatlari.html` dosyasini yukleyin (Add file → Upload).
2. Cloudflare Worker kodunu (`radar-proxy/worker.js`) Edit code ile Deploy edin.
3. Acin: https://fancy-scene-36a5.samsunsarraf55.workers.dev

Worker, HTML dosyasini GitHub raw / jsDelivr uzerinden sunar; `/api/*` proxy olarak calisir.

## Proxy URL (yerel HTML)

```
https://fancy-scene-36a5.samsunsarraf55.workers.dev
```
