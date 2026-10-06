// Bloqueia o zoom por toque duplo no iPhone. O CSS (touch-action: manipulation)
// já pede isso, mas o Safari às vezes ignora; aqui o segundo toque rápido é
// cancelado e o clique dele é entregue à mão, para tocar rápido continuar funcionando.
// O zoom de pinça (dois dedos) não é afetado.
(function () {
  var lastEnd = 0;
  var start = null;

  document.addEventListener('touchstart', function (event) {
    var touch = event.touches[0];
    start = event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
  }, { passive: true });

  document.addEventListener('touchend', function (event) {
    if (event.touches.length > 0 || event.changedTouches.length !== 1 || !start) {
      lastEnd = 0;
      return;
    }
    var touch = event.changedTouches[0];
    var moved = Math.abs(touch.clientX - start.x) > 10 || Math.abs(touch.clientY - start.y) > 10;
    var now = Date.now();
    var quick = now - lastEnd < 350;
    lastEnd = now;
    if (!quick || moved) return;

    var target = event.target;
    if (target.closest && target.closest('input, select, textarea, [contenteditable="true"]')) return;

    event.preventDefault();
    if (target.closest && target.closest('button:disabled')) return;
    target.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: touch.clientX,
      clientY: touch.clientY
    }));
  }, { passive: false });
})();
