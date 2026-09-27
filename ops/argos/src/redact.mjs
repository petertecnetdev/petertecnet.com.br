const SENSITIVE_KEY = /password|passwd|secret|token|credential|authorization|api[_-]?key/i;

export function redactString(value, maxLength = 12000) {
  return String(value ?? '')
    .slice(0, maxLength)
    .replace(/(authorization\s*:\s*bearer\s+)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/((?:password|passwd|secret|token|credential|api[_-]?key)\s*[=:]\s*)[^\s,;]+/gi, '$1[REDACTED]');
}

export function redact(value, depth = 0) {
  if (depth > 8) return '[MAX_DEPTH]';
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => redact(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).slice(0, 100).map(([key, item]) => {
    if (SENSITIVE_KEY.test(key)) return [key, '[REDACTED]'];
    return [key, redact(item, depth + 1)];
  }));
}
