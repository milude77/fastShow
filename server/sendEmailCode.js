import nodemailer from 'nodemailer';


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

export const sendEmailCode = async (email, code) => {
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'fastShow verification code',
        text: `感谢您参与fastShow，您的验证码是 ${code}, 五分钟内有效。请勿泄露给他人。`
    });
}