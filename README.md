# opencode-android-web — versi web full (tanpa APK/emulator)

UI asli app + server mock (chat simulasi, jawaban markdown + sitasi).

## Jalanin

```bash
node server.js
```

Buka browser: **http://127.0.0.1:8901**

## Stop (tanpa pkill)

```bash
kill $(cat server.pid)
```

## Catatan

- Chat dibalas simulasi (2 jawaban bergantian, ada sitasi [1][2]).
- Toggle web: forward ke DuckDuckGo asli (butuh internet bebas).
- Game, tema, riwayat: jalan penuh (localStorage browser).
- Folder ini TERPISAH dari repo app — edit app tidak otomatis ikut.
  Sync ulang: `cp -a ~/opencode-android/assets/ui/. ~/opencode-android-web/docs/`
