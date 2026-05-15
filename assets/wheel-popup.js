/**
 * Popup + email + ruleta.
 * Modo normal: una participación por sesión de navegador (sessionStorage).
 * Modo prueba ilimitada: añadí ?ruleta_prueba=1 a la URL, o en consola:
 *   localStorage.setItem('vr_ruleta_modo_prueba','1')
 * Luego recargá. Para volver al modo normal: localStorage.removeItem('vr_ruleta_modo_prueba')
 *
 * Email del premio (Resend): ejecutá `npm install` y `npm start` para servir la web y POST /api/ruleta-premio.
 * Si el HTML está en otro dominio, definí la base del API: meta name="vr-ruleta-api" o window.__VR_RULETA_API__.
 */
(function () {
  var STORAGE = {
    usedEmails: 'vr_roulette_used_emails',
    records: 'vr_roulette_records',
    testRecords: 'vr_ruleta_test_records'
  };

  var SESSION_KEY = 'vr_ruleta_completo';

  /** Etiquetas cortas para el canvas; title + message + hook al mostrar resultado. */
  var VR_PRIZES = [
    {
      id: 'bono_oro',
      wheelLabel: 'Bono Oro',
      label: 'Bono Oro',
      title: 'Bono Oro — USD 1.500 de descuento',
      message:
        '¡Felicidades! Ganaste $1,500 USD de descuento directo para tu parcela en Viña Roots. ¡Tu inversión premium hoy es más accesible que nunca!',
      hook: 'Tus 12 cuotas mensuales bajan de $983 USD a solo $858 USD.'
    },
    {
      id: 'bono_plata',
      wheelLabel: 'Bono Plata',
      label: 'Bono Plata',
      title: 'Bono Plata — USD 1.000 de descuento',
      message:
        '¡Espectacular! Te llevas $1,000 USD de regalo para aplicar a la compra de tu parcela de 10 años en Viña Roots. ¡Asegurá tus 80 botellas anuales!',
      hook: 'Tus cuotas mensuales bajan a $900 USD por un año entero.'
    },
    {
      id: 'bono_bronce',
      wheelLabel: 'Bono Bronce',
      label: 'Bono Bronce',
      title: 'Bono Bronce — USD 500 de descuento',
      message:
        '¡Ganaste! Tenés $500 USD de descuento para tu parcela en Viña Roots. Financiá el saldo en 12 meses y accedé al derecho real de superficie sobre tu parcela con tu vino durante 10 años.',
      hook: 'Tus cuotas mensuales quedan en $941 USD.'
    },
    {
      id: 'pase_vip',
      wheelLabel: 'Pase VIP',
      label: 'Pase VIP',
      title: 'Pase VIP — Visita a la finca para 2',
      message:
        '¡Salud! Ganaste una visita guiada privada para 2 personas a nuestra finca. Vení a conocer el suelo donde nace tu vino premium.',
      hook: 'Ideal para que vayan a conocer el viñedo y termines de cerrar la venta allá.'
    },
    {
      id: 'beneficio_plus',
      wheelLabel: '+5 botellas',
      label: 'Beneficio Plus',
      title: 'Beneficio Plus — +5 botellas el primer año',
      message:
        '¡Premio Premium! Al adquirir tu parcela en Viña Roots, el primer año te regalamos 5 botellas extra. ¡85 botellas para festejar a lo grande!'
    },
    {
      id: 'pase_fundador',
      wheelLabel: 'Fundador',
      label: 'Pase Fundador',
      title: 'Pase de Fundador — Eventos exclusivos',
      message:
        '¡Acceso VIP! Ganaste la Membresía de Fundador Viña Roots. Entrás a la lista prioritaria para lanzamientos de ediciones limitadas de la bodega.'
    },
    {
      id: 'copa_stand',
      wheelLabel: 'Copa premium',
      label: 'Copa en stand',
      title: 'Copa premium en stand',
      message:
        '¡A brindar! Te ganaste una copa extra de nuestro vino premium en la barra. Disfrutá el sabor de Viña Roots ahora mismo.'
    },
    {
      id: 'charla_dueno',
      wheelLabel: 'Charla VIP',
      label: 'Charla con el dueño',
      title: 'Charla exclusiva con el dueño',
      message:
        '¡Pase Privado! Vení detrás de la barra a hacer un brindis exclusivo con el dueño de la finca y conocer los secretos de Viña Roots.'
    },
    {
      id: 'botella_regalo',
      wheelLabel: '1 botella',
      label: 'Botella regalo',
      title: 'Botella de vino de regalo',
      message:
        '¡Salud! Ganaste una botella de vino de regalo. Te enviamos un código único por email para canjearla en el stand de Viña Roots.',
      hook: 'Mostrá el código en la barra y llevate tu botella premium.'
    },
    {
      id: 'sin_premio',
      wheelLabel: 'Otra vez',
      label: 'Seguí participando',
      title: 'Para la próxima',
      isNoPrize: true,
      message:
        'Esta vez la ruleta no te dejó premio, pero la suerte puede cambiar. ¡Gracias por participar con Viña Roots!',
      hook: 'Seguí descubriendo el stand: charlá con el equipo y volvé a intentarlo en futuras acciones.'
    }
  ];

  function wheelSegmentLabel(prize) {
    var s = prize.wheelLabel || prize.label || '';
    if (s.length > 20) s = s.slice(0, 18) + '\u2026';
    return s;
  }

  function launchConfetti(overlayEl, isNoPrize) {
    if (!overlayEl) return;
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    } catch (e) {}
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = window.innerWidth;
    var H = window.innerHeight;
    var c = document.createElement('canvas');
    c.className = 'vr-confetti-canvas';
    c.setAttribute('aria-hidden', 'true');
    c.width = Math.floor(W * dpr);
    c.height = Math.floor(H * dpr);
    c.style.width = W + 'px';
    c.style.height = H + 'px';
    overlayEl.appendChild(c);
    var ctx = c.getContext('2d');
    if (!ctx) {
      c.remove();
      return;
    }
    var count = isNoPrize ? 55 : 130;
    var golds = ['#C9A84C', '#E2C97E', '#f0deb0', '#8B6914'];
    var rich = golds.concat(['#F5F0E8', '#c45a5a', '#fff9f0', '#6B1A1A']);
    var dull = ['rgba(180,170,160,0.95)', 'rgba(201,168,76,0.45)', 'rgba(120,110,105,0.9)', 'rgba(160,150,145,0.75)'];
    var palette = isNoPrize ? dull : rich;
    var originX = W * 0.5;
    var originY = H * 0.36;
    var particles = [];
    var i;
    for (i = 0; i < count; i++) {
      var ang = (Math.PI * 2 * i) / count + Math.random() * 0.8;
      var speed = (isNoPrize ? 4 : 6) + Math.random() * 9;
      particles.push({
        x: originX + (Math.random() - 0.5) * 40,
        y: originY + (Math.random() - 0.5) * 30,
        vx: Math.cos(ang) * speed * (0.4 + Math.random() * 0.9),
        vy: Math.sin(ang) * speed * (0.4 + Math.random() * 0.9) - (isNoPrize ? 2 : 4),
        g: 0.12 + Math.random() * 0.18,
        drag: 0.988 + Math.random() * 0.008,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.25,
        w: 5 + Math.random() * 9,
        h: 3 + Math.random() * 7,
        color: palette[Math.floor(Math.random() * palette.length)],
        spin: Math.random() > 0.5
      });
    }
    var t0 = performance.now();
    var duration = isNoPrize ? 2200 : 3200;
    function tick(now) {
      var t = now - t0;
      var alpha = t > duration - 400 ? Math.max(0, 1 - (t - (duration - 400)) / 400) : 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.globalAlpha = alpha;
      ctx.scale(dpr, dpr);
      var j;
      for (j = 0; j < particles.length; j++) {
        var p = particles[j];
        p.vy += p.g;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.spin) {
          ctx.fillRect(-p.w * 0.5, -p.h * 0.5, p.w, p.h);
        } else {
          ctx.beginPath();
          ctx.moveTo(-p.w * 0.5, 0);
          ctx.lineTo(0, -p.h);
          ctx.lineTo(p.w * 0.5, 0);
          ctx.lineTo(0, p.h);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (t < duration) {
        requestAnimationFrame(tick);
      } else {
        try {
          c.remove();
        } catch (e2) {}
      }
    }
    requestAnimationFrame(tick);
  }

  function renderPrizeResult(container, prize) {
    container.textContent = '';
    var titleEl = document.createElement('div');
    titleEl.className = 'vr-prize-title';
    titleEl.textContent = prize.title || prize.label || '';
    container.appendChild(titleEl);
    var msgEl = document.createElement('p');
    msgEl.className = 'vr-prize-message';
    msgEl.textContent = prize.message || '';
    container.appendChild(msgEl);
    if (prize.hook) {
      var hookEl = document.createElement('p');
      hookEl.className = 'vr-prize-hook';
      hookEl.textContent = prize.hook;
      container.appendChild(hookEl);
    }
  }

  function isTestMode() {
    try {
      if (/[?&]ruleta_prueba=1(?:&|$)/.test(window.location.search)) return true;
      if (localStorage.getItem('vr_ruleta_modo_prueba') === '1') return true;
    } catch (e) {}
    return false;
  }

  function readJson(key, fallback) {
    try {
      var s = localStorage.getItem(key);
      return s ? JSON.parse(s) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
  }

  function normEmail(e) {
    return String(e || '')
      .trim()
      .toLowerCase();
  }

  /** Vacío = ok. Si hay texto, valida formato suave (AR/internacional). */
  function parseTelefonoOpcional(raw) {
    var s = String(raw || '').trim();
    if (!s) return { ok: true, value: '' };
    if (s.length > 40) return { ok: false, error: 'El teléfono es demasiado largo.' };
    if (!/^[\d+().\s-]+$/.test(s)) {
      return { ok: false, error: 'Teléfono: solo números y símbolos + ( ) - .' };
    }
    var digits = s.replace(/\D/g, '');
    if (digits.length < 6) {
      return { ok: false, error: 'Si completás teléfono, incluí al menos 6 dígitos.' };
    }
    return { ok: true, value: s };
  }

  function randomIndex(n) {
    if (n <= 1) return 0;
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var max = Math.floor(0x100000000 / n) * n;
      var buf = new Uint32Array(1);
      var x;
      do {
        crypto.getRandomValues(buf);
        x = buf[0];
      } while (x >= max);
      return x % n;
    }
    return Math.floor(Math.random() * n);
  }

  function getUsedEmails() {
    return readJson(STORAGE.usedEmails, []);
  }

  function getRecords() {
    return readJson(STORAGE.records, []);
  }

  function getTestRecords() {
    return readJson(STORAGE.testRecords, []);
  }

  function buildParticipacionRecord(email, telefono, ip, prize) {
    var titulo = prize.title || prize.label || '';
    var base = {
      email: email,
      telefono: telefono || '',
      premioGanado: titulo,
      premioId: prize.id,
      premioMensaje: prize.message || '',
      premioGancho: prize.hook || '',
      esSinPremio: !!prize.isNoPrize,
      resumenParticipacion:
        email + (telefono ? ' · ' + telefono : '') + ' — ' + titulo,
      ip: ip || '',
      prizeId: prize.id,
      prizeLabel: titulo,
      at: new Date().toISOString()
    };
    if (!prize.isNoPrize) {
      base.cuponAplica = true;
      base.cuponCodigo = null;
      base.cuponValidoHasta = null;
      base.cuponVigenciaMeses = null;
      base.cuponCodigoUnico = null;
      base.cuponNota =
        'Los cupones enviados por email tienen vigencia de 2 meses desde la emisión; cada código es único e intransferible.';
    }
    return base;
  }

  function patchLastParticipacionRecord(email, prizeId, cupon) {
    if (!cupon || !cupon.codigo) return;
    var rec = getRecords();
    for (var i = rec.length - 1; i >= 0; i--) {
      if (
        rec[i].email === email &&
        rec[i].prizeId === prizeId &&
        (rec[i].cuponCodigo == null || rec[i].cuponCodigo === '')
      ) {
        rec[i].cuponCodigo = cupon.codigo;
        rec[i].cuponValidoHasta = cupon.validoHasta;
        rec[i].cuponVigenciaMeses = cupon.vigenciaMeses != null ? cupon.vigenciaMeses : 2;
        rec[i].cuponCodigoUnico = cupon.codigoUnico === true;
        rec[i].cuponNota =
          'Los cupones enviados por email tienen vigencia de 2 meses desde la emisión; cada código es único e intransferible.';
        writeJson(STORAGE.records, rec);
        return;
      }
    }
  }

  function persistNormal(email, telefono, ip, prize) {
    var emails = getUsedEmails();
    if (emails.indexOf(email) === -1) emails.push(email);
    writeJson(STORAGE.usedEmails, emails);

    var rec = getRecords();
    rec.push(buildParticipacionRecord(email, telefono, ip, prize));
    writeJson(STORAGE.records, rec);

    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch (e) {}
  }

  function persistTest(email, telefono, ip, prize) {
    var rec = getTestRecords();
    rec.push(buildParticipacionRecord(email, telefono, ip, prize));
    writeJson(STORAGE.testRecords, rec);
  }

  function getRuletaPremioUrl() {
    try {
      if (typeof window.__VR_RULETA_API__ === 'string' && window.__VR_RULETA_API__.trim()) {
        return window.__VR_RULETA_API__.replace(/\/$/, '') + '/api/ruleta-premio';
      }
      var m = document.querySelector('meta[name="vr-ruleta-api"]');
      var c = m && m.getAttribute('content');
      if (c && String(c).trim()) return String(c).replace(/\/$/, '') + '/api/ruleta-premio';
    } catch (e) {}
    return '/api/ruleta-premio';
  }

  function notifyPremioResend(email, telefono, prize, ip, isTest) {
    if (isTest) return Promise.resolve(null);
    var url = getRuletaPremioUrl();
    var payload = {
      email: email,
      prizeId: prize.id,
      premioGanado: prize.title || prize.label || '',
      premioMensaje: prize.message || '',
      premioGancho: prize.hook || '',
      ip: ip || ''
    };
    if (telefono) payload.telefono = telefono;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.text().then(function (text) {
        var j = {};
        try {
          j = text ? JSON.parse(text) : {};
        } catch (parseErr) {
          j = {};
        }
        if (!r.ok || !j.ok) {
          throw new Error((j && j.error) || r.statusText || 'Error al enviar el email');
        }
        return j;
      });
    });
  }

  function fetchIp() {
    return fetch('https://api.ipify.org?format=json', { cache: 'no-store' })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        return j && j.ip ? String(j.ip) : '';
      })
      .catch(function () {
        return '';
      });
  }

  function resolveIpFallback() {
    var ip = localStorage.getItem('vr_roulette_fallback_id');
    if (!ip) {
      ip =
        'dev_' +
        (typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now()) + '_' + Math.random().toString(36).slice(2, 9));
      try {
        localStorage.setItem('vr_roulette_fallback_id', ip);
      } catch (e) {}
    }
    return ip;
  }

  function drawWheel(canvas, prizes) {
    var n = prizes.length;
    if (!n || !canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var logical = 280;
    var dpr = canvas.width / logical;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    var cx = logical / 2;
    var cy = logical / 2;
    var r = logical / 2 - 6;
    ctx.translate(cx, cy);
    var seg = (Math.PI * 2) / n;
    var colors = ['#3d1818', '#2a1212', '#4a2220', '#321414', '#4a3020', '#2e1810'];
    for (var i = 0; i < n; i++) {
      var a0 = -Math.PI / 2 + i * seg;
      var a1 = -Math.PI / 2 + (i + 1) * seg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = prizes[i].isNoPrize ? '#2a2424' : colors[i % colors.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(201,168,76,.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.save();
      ctx.rotate(a0 + seg / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(245,240,232,.95)';
      ctx.font = '600 ' + (n > 8 ? '9px' : '11px') + ' Raleway, system-ui, sans-serif';
      var label = wheelSegmentLabel(prizes[i]);
      ctx.fillText(label, r - 12, 4);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#140808';
    ctx.fill();
    ctx.strokeStyle = '#C9A84C';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function init() {
    var overlay = document.getElementById('vr-launch-overlay');
    if (!overlay) return;

    var stepEmail = document.getElementById('vr-step-email');
    var stepWheel = document.getElementById('vr-step-wheel');
    var form = document.getElementById('vr-email-form');
    var input = document.getElementById('vr-email-input');
    var phoneInput = document.getElementById('vr-phone-input');
    var errEl = document.getElementById('vr-email-err');
    var rotor = document.getElementById('vr-wheel-rotor');
    var canvas = document.getElementById('vr-wheel-canvas');
    var spinBtn = document.getElementById('vr-spin-btn');
    var resultEl = document.getElementById('vr-wheel-result');
    var closeBtn = document.getElementById('vr-launch-close');
    var termsCheckbox = document.getElementById('vr-terms-checkbox');
    var termsToggle = document.getElementById('vr-terms-toggle');
    var termsPanel = document.getElementById('vr-terms-panel');

    if (!form || !spinBtn || !closeBtn || !stepEmail || !stepWheel) return;

    if (termsToggle && termsPanel) {
      termsToggle.setAttribute('aria-expanded', 'false');
      termsToggle.addEventListener('click', function () {
        var show = termsPanel.hidden;
        termsPanel.hidden = !show;
        termsToggle.setAttribute('aria-expanded', show ? 'true' : 'false');
        termsToggle.textContent = show
          ? 'Ocultar términos y condiciones'
          : 'Leer términos y condiciones';
      });
    }

    var ip = '';
    var currentEmail = '';
    var currentTelefono = '';
    var rotationDeg = 0;
    var spinning = false;
    var prizes = VR_PRIZES;
    var test = isTestMode();

    function showOverlay() {
      overlay.classList.add('is-visible');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function hideOverlay() {
      overlay.classList.remove('is-visible');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    function maybeShow() {
      if (!test) {
        try {
          if (sessionStorage.getItem(SESSION_KEY) === '1') return;
        } catch (e) {}
      }
      requestAnimationFrame(function () {
        showOverlay();
      });
      fetchIp().then(function (resolvedIp) {
        ip = resolvedIp || resolveIpFallback();
      });
    }

    if (canvas) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var size = 280;
      canvas.width = Math.floor(size * dpr);
      canvas.height = Math.floor(size * dpr);
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';
      drawWheel(canvas, prizes);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errEl.textContent = '';
      if (!termsCheckbox || !termsCheckbox.checked) {
        errEl.textContent = 'Debés aceptar los términos y condiciones para continuar.';
        return;
      }
      var email = normEmail(input.value);
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errEl.textContent = 'Ingresá un email válido.';
        return;
      }
      var telParsed = parseTelefonoOpcional(phoneInput ? phoneInput.value : '');
      if (!telParsed.ok) {
        errEl.textContent = telParsed.error;
        return;
      }
      currentTelefono = telParsed.value || '';
      if (!test) {
        var used = getUsedEmails();
        if (used.indexOf(email) !== -1) {
          errEl.textContent = 'Este email ya participó.';
          return;
        }
      }
      currentEmail = email;
      stepEmail.setAttribute('hidden', '');
      stepWheel.removeAttribute('hidden');
      stepWheel.style.display = 'block';
      rotationDeg = 0;
      if (rotor) {
        rotor.style.transition = 'none';
        rotor.style.transform = 'rotate(0deg)';
      }
      drawWheel(canvas, prizes);
    });

    spinBtn.addEventListener('click', function () {
      if (spinning || !canvas || !rotor) return;
      spinning = true;
      spinBtn.disabled = true;
      resultEl.classList.remove('is-on', 'is-no-prize');
      resultEl.textContent = '';

      var n = prizes.length;
      var winIndex = randomIndex(n);
      var seg = (2 * Math.PI) / n;
      var centerRad = -Math.PI / 2 + winIndex * seg + seg / 2;
      var alignRad = -Math.PI / 2 - centerRad;
      var alignDeg = (alignRad * 180) / Math.PI;
      var extraTurns = 6 + randomIndex(4);
      var deltaDeg = extraTurns * 360 + alignDeg;
      var endDeg = rotationDeg + deltaDeg;
      if (endDeg - rotationDeg < 360 * 5) endDeg += 360 * 2;

      rotor.classList.add('is-spinning');
      rotor.style.transition = 'none';
      rotor.style.transform = 'rotate(' + rotationDeg + 'deg)';
      void rotor.offsetWidth;
      rotor.style.transition = 'transform 4.4s cubic-bezier(.15,.82,.22,1)';
      rotor.style.transform = 'rotate(' + endDeg + 'deg)';

      var prize = prizes[winIndex];
      setTimeout(function () {
        rotationDeg = endDeg;
        spinning = false;
        rotor.classList.remove('is-spinning');
        renderPrizeResult(resultEl, prize);
        resultEl.classList.add('is-on');
        if (prize.isNoPrize) resultEl.classList.add('is-no-prize');
        launchConfetti(overlay, !!prize.isNoPrize);
        if (test) persistTest(currentEmail, currentTelefono, ip, prize);
        else persistNormal(currentEmail, currentTelefono, ip, prize);
        var pzId = prize.id;
        notifyPremioResend(currentEmail, currentTelefono, prize, ip, test)
          .then(function (j) {
            if (!test && j && j.cupon) {
              patchLastParticipacionRecord(currentEmail, pzId, j.cupon);
            }
          })
          .catch(function (err) {
            try {
              console.warn(
                '[VinyaRoots ruleta] Email Resend:',
                err && err.message ? err.message : err
              );
            } catch (e) {}
          });
        spinBtn.textContent = 'Listo';
      }, 4400);
    });

    closeBtn.addEventListener('click', function () {
      var confettiLayers = overlay.querySelectorAll('.vr-confetti-canvas');
      for (var ci = 0; ci < confettiLayers.length; ci++) confettiLayers[ci].remove();
      hideOverlay();
    });

    maybeShow();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
