const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // nodemailer has no timeout by default — a blocked or stalled SMTP
  // connection (common from PaaS hosts) hangs the request indefinitely, and
  // anything awaiting sendEmail hangs with it until the platform's own proxy
  // kills it, surfacing only as a bare 502. These bound every phase so a
  // failure comes back as an actual error instead.
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

const sendEmail = async ({ to, subject, html }) => {
  await transporter.sendMail({
    from: `"iRequestDologon" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};

module.exports = sendEmail;
