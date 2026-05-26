import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const enviarEmailRecuperacion = async (email, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Recuperación de Contraseña - Sistema Taller LR",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Arial', sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(90deg, #1a5cfb 0%, #4fa3ff 50%, #00c6ff 100%); padding: 30px; text-align: center; }
          .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
          .content { padding: 40px 30px; color: #333; }
          .content p { line-height: 1.6; margin-bottom: 20px; }
          .btn { display: inline-block; padding: 14px 32px; background: linear-gradient(90deg, #1a5cfb 0%, #4fa3ff 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
          .btn:hover { opacity: 0.9; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #e0e0e0; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Recuperación de Contraseña</h1>
          </div>
          <div class="content">
            <p>Hola,</p>
            <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en el <strong>Sistema Taller LR</strong>.</p>
            <p>Hacé clic en el siguiente botón para crear una nueva contraseña:</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="btn">Restablecer Contraseña</a>
            </div>
            <div class="warning">
              <strong>⏰ Este enlace expira en 1 hora.</strong>
            </div>
            <p>Si no solicitaste este cambio, podés ignorar este correo de forma segura.</p>
            <p style="margin-top: 30px; font-size: 13px; color: #666;">
              Si el botón no funciona, copiá y pegá este enlace en tu navegador:<br>
              <a href="${resetUrl}" style="color: #1a5cfb; word-break: break-all;">${resetUrl}</a>
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Sistema Taller LR. Todos los derechos reservados.</p>
            <p>Este es un correo automático, por favor no respondas.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};