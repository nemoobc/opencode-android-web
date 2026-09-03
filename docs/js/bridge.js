/* ===== bridge.js — Android/Web bridge ===== */
(function() {
  'use strict';

  /* Android mode — native Bridge class provides window.Android */
  if (typeof Android !== 'undefined') {
    /* Fallback: kalau server gagal start, onReady tidak pernah dipanggil.
       Auto-remove splash setelah 120s supaya user ngga stuck forever. */
    setTimeout(function() {
      var sp = document.getElementById('splash');
      if (sp && !sp.classList.contains('out')) {
        sp.classList.add('out');
        setTimeout(function() { if (sp.parentNode) sp.parentNode.removeChild(sp); }, 700);
      }
    }, 120000);
    return; /* native bridge ready, do nothing */
  }

  /* Web mode — mock Android bridge for browser testing */
  var OC_API = '';
  var _ocSession = null;
  var _ocRetries = 0;
  var _netFail = 0; /* gagal koneksi mentah (tanpa server) → lokal cepat */

  function createSession() {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', OC_API + '/api/session', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function() {
      if (xhr.status === 200) {
        try { _ocSession = JSON.parse(xhr.responseText).data.id; } catch(e) {}
      } else {
        _netFail++;
        if (_netFail >= 3) { _ocSession = 'local'; return; } /* 404/Pages = tanpa server */
        retrySession();
      }
    };
    xhr.onerror = function() {
      _netFail++;
      if (_netFail >= 3) { _ocSession = 'local'; return; } /* offline jelas → langsung lokal */
      retrySession();
    };
    xhr.send('{}');
  }
  /* mode offline (GitHub Pages statis, tanpa server): jawab simulasi lokal.
     Aktif otomatis kalau /api/session tak terjangkau. */
  var _localN = 0;
  var LOCAL_ANS = [
    '## Harga Emas Hari Ini\n\nHarga emas naik ke **Rp 1,5 juta** per gram [1].\n\n- Pemicu: permintaan global naik [2]\n- Tren: menguat 3 hari beruntun\n\n```text\nANTAM 1gr = Rp1.500.000\nUBS 1gr   = Rp1.495.000\n```\n\nKesimpulan: cocok buat jaga-jaga, bukan spekulasi [1].',
    '## Hasil Pencarian Web\n\nDitemukan **2 sumber** relevan [1][2]:\n\n1. Judul pertama membahas tren terbaru\n2. Judul kedua berisi data pembanding\n\n> Kutipan: pasar bergerak positif minggu ini.\n\nMau saya gali salah satu sumber lebih dalam? [2]'
  ];
  function localFake() {
    var text = LOCAL_ANS[_localN++ % LOCAL_ANS.length];
    /* sumber simulasi biar footer + sitasi konsisten (demo tanpa DDG) */
    try {
      if (typeof WebSearch !== 'undefined' && WebSearch) {
        WebSearch.lastResults = [
          { title: 'Harga Emas Hari Ini — Logam Mulia', url: 'https://ex.com/emas', snippet: 'Emas naik' },
          { title: 'Grafik Emas 2026 Naik Terus', url: 'https://ex.com/grafik', snippet: 'Tren menguat' }
        ];
      }
    } catch (e) {}
    var words = text.split(' '), wi = 0;
    var si = setInterval(function() {
      if (wi < words.length) { if (typeof window.appendOut === 'function') window.appendOut(words[wi] + ' '); wi++; }
      else { clearInterval(si); if (typeof window.onDone === 'function') window.onDone(0); }
    }, 25);
  }
  function retrySession() {
    _ocRetries++;
    if (_ocRetries > 15) {
      _ocSession = 'local'; /* server ga ada → mode offline */
      return;
    }
    setTimeout(createSession, 2000);
  }
  createSession();

  window.Android = {
    send: function(t) {
      if (_ocSession === 'local') { setTimeout(localFake, 900); return 0; }
      if (!_ocSession) {
        if (_ocRetries > 15) { _ocSession = 'local'; setTimeout(localFake, 900); return 0; }
        setTimeout(function() { window.Android.send(t); }, 1500);
        return 0;
      }
      var xhr = new XMLHttpRequest();
      xhr.open('POST', OC_API + '/api/session/' + _ocSession + '/prompt', true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = function() {
        if (xhr.status === 200) { pollMessages(); }
        else { if (typeof window.onDone === 'function') window.onDone(1); }
      };
      xhr.onerror = function() { if (typeof window.onDone === 'function') window.onDone(1); };
      xhr.send(JSON.stringify({ prompt: { text: t } }));
      function pollMessages() {
        var tries = 0;
        var interval = setInterval(function() {
          tries++;
          if (tries > 60) { clearInterval(interval); if (typeof window.onDone === 'function') window.onDone(1); return; }
          var mxhr = new XMLHttpRequest();
          mxhr.open('GET', OC_API + '/api/session/' + _ocSession + '/message', true);
          mxhr.onload = function() {
            if (mxhr.status === 200) {
              try {
                var msgs = JSON.parse(mxhr.responseText).data;
                var assistant = null;
                for (var i = msgs.length - 1; i >= 0; i--) { if (msgs[i].type === 'assistant') { assistant = msgs[i]; break; } }
                if (assistant && assistant.content) {
                  clearInterval(interval);
                  var text = '';
                  for (var j = 0; j < assistant.content.length; j++) { if (assistant.content[j].type === 'text') text += assistant.content[j].text; }
                  if (text && typeof window.appendOut === 'function') {
                    var words = text.split(' '), wi = 0;
                    var si = setInterval(function() { if (wi < words.length) { window.appendOut(words[wi] + ' '); wi++; } else { clearInterval(si); if (typeof window.onDone === 'function') window.onDone(0); } }, 20);
                  } else { if (typeof window.onDone === 'function') window.onDone(0); }
                }
              } catch(e) {}
            }
          };
          mxhr.send();
        }, 800);
      }
      return 0;
    },
    cancel: function() { if (_ocSession) { var xhr = new XMLHttpRequest(); xhr.open('POST', OC_API + '/api/session/' + _ocSession + '/interrupt', true); xhr.setRequestHeader('Content-Type', 'application/json'); xhr.send('{}'); } },
    copyText: function(t) { navigator.clipboard.writeText(t).catch(function(){}); },
    openUrl: function(u) { window.open(u, '_blank'); },
    newChat: function() { _ocSession = null; _ocRetries = 0; createSession(); },
    checkUpdate: function() {},
    saveConfig: function(p, k, m) { localStorage.setItem('oc-cfg', JSON.stringify({provider:p,key:k,model:m})); },
    readConfig: function() { return localStorage.getItem('oc-cfg') || '{}'; },
    fetchModels: function() {},
    pickFile: function() {
      var input = document.createElement('input');
      input.type = 'file';
      input.onchange = function() {
        try { input.value = ''; } catch (e) {}
        var f = input.files[0];
        if (!f) return;
        /* mode dev-lock: baca isi teks langsung (web ga ada path file) */
        if (window._devPick && typeof window._devFileText === 'function' && typeof FileReader !== 'undefined') {
          var dm = document.getElementById('dev-msg');
          if (dm) dm.textContent = 'Membaca file...';
          var rd = new FileReader();
          rd.onload = function() { try { window._devFileText(rd.result); } catch (e) {
            if (dm) dm.textContent = 'Gagal baca: ' + e; } };
          rd.onerror = function() {
            if (dm) dm.textContent = 'File tidak terbaca oleh browser.';
            try { window._devFileText(''); } catch (e) {} };
          rd.readAsText(f);
          return;
        }
        if (f) window.onFileReady(f.name, f.name);
      };
      input.click();
    },
    readImageDataUrl: function(p) { return null; },
    appInfo: function() { return 'web-1.0'; }
  };

  /* web demo: simulasi ekstrak 0-100% (di app asli didorong Java).
     JANGAN copy ke app — app pake push native. */
  (function() {
    var n = 0, total = 528;
    if (typeof window.setStage === 'function') window.setStage('menyiapkan sistem — mengekstrak...');
    var iv = setInterval(function() {
      /* langkah kecil + sering = gerak mentega (dulu lompat 8-28/200ms) */
      var left = total - n;
      var step = Math.min(left, 5 + Math.floor(Math.random() * 4));
      /* melambat natural dekat 100% */
      if (left < 60) step = Math.min(left, 2);
      n += step;
      if (n >= total) {
        n = total;
        clearInterval(iv);
        if (typeof window.setProgress === 'function') window.setProgress(n);
        if (typeof window.setProgressBytes === 'function') window.setProgressBytes(4839338);
        if (typeof window.setStage === 'function') window.setStage('menyalakan server AI...');
        setTimeout(readyNow, 2500);
        return;
      }
      if (typeof window.setProgress === 'function') window.setProgress(n);
      if (typeof window.setProgressBytes === 'function') window.setProgressBytes(Math.floor(4839338 * n / total));
    }, 80);
  })();
  function readyNow() {
    var sp = document.getElementById('splash');
    if (sp) { sp.classList.add('out'); setTimeout(function() { if (sp.parentNode) sp.parentNode.removeChild(sp); }, 700); }
    if (typeof window.onReady === 'function') window.onReady(true, true);
  }
})();
