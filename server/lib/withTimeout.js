// Races a promise against a hard deadline. Use this around any outbound call
// (SMS, email, third-party API) whose own timeout options can't be fully
// trusted — DNS resolution and connection queuing, in particular, often fall
// outside a library's configured socket/connection timeout. Without this, a
// stalled call hangs the request until the host's proxy kills it, which shows
// up to the client as a bare 502 with no diagnostic message.
function withTimeout(promise, ms, label = 'operation') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

module.exports = withTimeout;
