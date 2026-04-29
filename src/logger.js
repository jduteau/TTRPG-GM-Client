/**
 * Leveled browser logger.
 *
 * Set VITE_LOG_LEVEL in .env to one of:
 *   error  — runtime errors only
 *   warn   — errors + warnings
 *   info   — (default) key lifecycle events
 *   debug  — everything above + request/response details
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function currentLevel() {
  const raw = (import.meta.env.VITE_LOG_LEVEL ?? 'info').toLowerCase();
  return LEVELS[raw] ?? LEVELS.info;
}

function emit(level, tag, ...args) {
  if (LEVELS[level] > currentLevel()) return;
  const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
  const prefix = `[${ts}] [${level.toUpperCase().padEnd(5)}] [${tag}]`;
  switch (level) {
    case 'error': console.error(prefix, ...args); break;
    case 'warn':  console.warn(prefix, ...args);  break;
    case 'debug': console.debug(prefix, ...args); break;
    default:      console.info(prefix, ...args);  break;
  }
}

export function createLogger(tag) {
  return {
    error: (...args) => emit('error', tag, ...args),
    warn:  (...args) => emit('warn',  tag, ...args),
    info:  (...args) => emit('info',  tag, ...args),
    debug: (...args) => emit('debug', tag, ...args),
  };
}
