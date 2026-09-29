// アプリの中の数字キーパッド。端末のキーボードは出さない（input 要素を使わない）。

const ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

export function buildKeypad(padEl, onDigit) {
  padEl.textContent = '';
  for (const n of ORDER) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'key';
    button.textContent = String(n);
    button.dataset.digit = String(n);
    padEl.append(button);
  }
  padEl.addEventListener('click', (event) => {
    const key = event.target.closest('.key');
    if (!key || key.disabled) return;
    onDigit(Number(key.dataset.digit));
  });
}

export function setKeypadEnabled(padEl, enabled) {
  for (const key of padEl.querySelectorAll('.key')) key.disabled = !enabled;
}
