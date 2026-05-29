const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS, // Use App Password for Gmail
            },
        });

        // Ensure methods are bound to this instance
        this.sendOTP = this.sendOTP.bind(this);
        this.sendPaymentReceipt = this.sendPaymentReceipt.bind(this);
    }

    /**
     * Send OTP for password reset
     */
    async sendOTP(email, otp) {
        const mailOptions = {
            from: `"HealthSync Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Your HealthSync Password Reset OTP',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #0071e3; text-align: center;">HealthSync</h2>
                    <p>Hello,</p>
                    <p>You requested to reset your password. Use the following One-Time Password (OTP) to proceed. This OTP is valid for 10 minutes.</p>
                    <div style="background: #f5f5f7; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1d1d1f; border-radius: 8px; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p>If you did not request this, please ignore this email or contact support if you have concerns.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #86868b; text-align: center;">&copy; 2026 HealthSync Patient Portal. All rights reserved.</p>
                </div>
            `,
        };

        return this.transporter.sendMail(mailOptions);
    }

    /**
     * Send Payment Receipt for successfully booked appointment
     */
    async sendPaymentReceipt(email, appointmentDetails) {
        const mailOptions = {
            from: `"HealthSync Billing" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Payment Receipt: HealthSync Appointment #${appointmentDetails.queueNumber || ''}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #0071e3; text-align: center;">Payment Successful</h2>
                    <p>Hello,</p>
                    <p>Thank you for your payment. Your appointment is confirmed.</p>
                    
                    <div style="background: #f5f5f7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #1d1d1f;">Receipt Details</h3>
                        <p><strong>Amount Paid:</strong> ₹${appointmentDetails.amount}</p>
                        <p><strong>Doctor:</strong> Dr. ${appointmentDetails.doctorName}</p>
                        <p><strong>Date:</strong> ${appointmentDetails.date}</p>
                        <p><strong>Time:</strong> ${appointmentDetails.time}</p>
                    </div>

                    <p>If you have any questions, please contact our support team.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #86868b; text-align: center;">&copy; ${new Date().getFullYear()} HealthSync Patient Portal. All rights reserved.</p>
                </div>
            `,
        };

        return this.transporter.sendMail(mailOptions);
    }
}

module.exports = new EmailService();
