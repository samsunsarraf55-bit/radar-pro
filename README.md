# RADAR PRO

## Guncellemeler neden gorunmuyor?

Worker, uygulamayi **GitHub**daki `radar-pro-latest.html` dosyasindan okur.
Siz sadece bilgisayardaki HTML'i guncellerseniz site degismez.

## Ne yapmalisiniz?

1. En guncel **radar-pro-latest.html** (veya altin-fiyatlari.html) dosyasini bilgisayariniza alin
2. https://github.com/samsunsarraf55-bit/radar-pro/upload/main
3. Dosyayi surukleyin, isim: `radar-pro-latest.html` → Commit
4. Cloudflare Worker **Edit code** → asagidaki worker.js Raw kopyala → Deploy
5. Site: https://fancy-scene-36a5.samsunsarraf55.workers.dev  (Ctrl+F5)

Worker: https://github.com/samsunsarraf55-bit/radar-pro/blob/main/radar-proxy/worker.js
