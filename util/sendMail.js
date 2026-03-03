const nodemailer = require("nodemailer");

const sendMail = async (opts) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOpts = {
    from:'liturl <admin@liturl.com>',
    to: opts.email,
    subject: opts.subject,
    text: opts.message
  }

  await transporter.sendMail(mailOpts)

};

module.exports = sendMail
