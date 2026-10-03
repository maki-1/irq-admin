function todayInManila(now = new Date()) {
  return now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Manila' });
}

function validateBirthday(value, now = new Date()) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) {
    return { error: 'Please enter a valid birthday.' };
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return { error: 'Please enter a valid birthday.' };
  }
  const today = todayInManila(now);
  if (value > today) return { error: 'Birthday cannot be later than today.' };
  const age = Number(today.slice(0, 4)) - Number(value.slice(0, 4)) - (today.slice(5) < value.slice(5) ? 1 : 0);
  return { date, age };
}

module.exports = { todayInManila, validateBirthday };
