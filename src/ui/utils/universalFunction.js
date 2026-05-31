export function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

export function throttle(func, delay) {
  let lastCallTime = 0;
  return function (...args) {
    const currentTime = Date.now();
    if (currentTime - lastCallTime >= delay) {
      lastCallTime = currentTime;
      func.apply(this, args);
    }
  };
}