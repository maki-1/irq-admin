function notificationContact(input, { localOnly = false } = {}) {
  const data = {};
  if (input.contactNumber !== undefined) {
    const value = String(input.contactNumber ?? '').trim();
    if (localOnly && value && !/^09\d{9}$/.test(value)) {
      return { error: 'Contact number must contain exactly 11 digits and start with 09.' };
    }
    const digits = value.replace(/\D/g, '');
    const local = digits.startsWith('63') ? '0' + digits.slice(2) : digits;
    if (value && (!/^[+\d\s().-]+$/.test(value) || !/^09\d{9}$/.test(local))) {
      return { error: 'Contact number must be a valid Philippine mobile number (09XXXXXXXXX or +639XXXXXXXXX).' };
    }
    data.contactNumber = value ? local : null;
  }
  if (input.notifyEmail !== undefined) {
    const value = String(input.notifyEmail ?? '').toLowerCase().trim();
    if (value && (value.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value))) {
      return { error: 'Notification email is not a valid address.' };
    }
    data.notifyEmail = value || null;
  }
  return { data };
}

module.exports = { notificationContact };
