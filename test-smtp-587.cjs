const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'mail.waruwenjo.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: 'support@waruwenjo.com',
    pass: 'Support@WaruWenJo'
  }
});

transporter.verify(function(error, success) {
  if (error) {
    console.log("SMTP Error on 587:");
    console.log(error);
  } else {
    console.log("Server is ready to take our messages on 587!");
  }
});
