const axios = require('axios');

const sendSms = async ({ to, message }) => {
  // Format to +63XXXXXXXXX
  const digits = to.replace(/\D/g, '');
  const phone  = digits.startsWith('63') ? `+${digits}` : `+63${digits.replace(/^0/, '')}`;

  const payload = { recipient: phone, content: message };

  console.log('[sendSms] payload:', JSON.stringify(payload));

  const { data } = await axios.post(
    'https://unismsapi.com/api/sms',
    payload,
    {
      auth: {
        username: process.env.UNISMS_API_KEY,
        password: '',
      },
      headers: { 'Content-Type': 'application/json' },
    }
  );

  console.log('[sendSms] response:', JSON.stringify(data));
  return data;
};

module.exports = sendSms;
