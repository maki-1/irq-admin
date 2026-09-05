const axios = require('axios');

// UNISMS requires a registered sender_id — without one every send is rejected
// 422 {"errors":{"sender_id":["can't be blank"]}}. Set UNISMS_SENDER_ID to a
// sender registered on the account (account endpoint must show sid_tokens > 0).
const sendSms = async ({ to, message }) => {
  // Format to +63XXXXXXXXX
  const digits = to.replace(/\D/g, '');
  const phone  = digits.startsWith('63') ? `+${digits}` : `+63${digits.replace(/^0/, '')}`;

  const senderId = process.env.UNISMS_SENDER_ID;
  if (!senderId) {
    // Fail loudly rather than firing a request UNISMS will reject anyway.
    throw new Error('UNISMS_SENDER_ID is not configured — SMS cannot be sent');
  }

  const payload = { recipient: phone, content: message, sender_id: senderId };

  try {
    const { data } = await axios.post(
      'https://unismsapi.com/api/sms',
      payload,
      {
        auth: { username: process.env.UNISMS_API_KEY, password: '' },
        headers: { 'Content-Type': 'application/json' },
      }
    );
    return data;
  } catch (err) {
    // Surface UNISMS's own validation detail (sender_id / content / credits) so
    // callers and logs see why a send failed instead of a bare status code.
    const detail = err.response?.data?.errors || err.response?.data || err.message;
    const e = new Error(`UNISMS rejected the message: ${JSON.stringify(detail)}`);
    e.smsDetail = detail;
    throw e;
  }
};

module.exports = sendSms;
