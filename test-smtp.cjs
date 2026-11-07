const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'mail.waruwenjo.com',
  port: 465,
  secure: true,
  auth: {
    user: 'support@waruwenjo.com',
    pass: 'Support@WaruWenJo'
  }
});

transporter.verify(function(error, success) {
  if (error) {
    console.log("SMTP Error:");
    console.log(error);
  } else {
    console.log("Server is ready to take our messages");
  }
});
