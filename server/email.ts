import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface ContactData {
  name: string;
  phone: string;
  email: string;
  message: string;
}

export async function sendContactEmail(data: ContactData) {
  /* WHITELABEL: Substituir email de destino */
  const to = process.env.CONTACT_EMAIL || "contato@seusite.com.br";

  await transporter.sendMail({
    /* WHITELABEL: Substituir nome do remetente */
    from: `"Site Medico" <${process.env.SMTP_USER}>`,
    to,
    replyTo: data.email,
    subject: `Nova consulta – ${data.name}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
        <h2 style="color:#2C3E50;margin-bottom:24px">Nova solicitacao de consulta</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="padding:8px 12px;font-weight:bold;color:#494949;vertical-align:top;width:100px">Nome</td>
            <td style="padding:8px 12px;color:#212529">${data.name}</td>
          </tr>
          <tr style="background:#f9fafb">
            <td style="padding:8px 12px;font-weight:bold;color:#494949;vertical-align:top">Telefone</td>
            <td style="padding:8px 12px;color:#212529">${data.phone}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;font-weight:bold;color:#494949;vertical-align:top">E-mail</td>
            <td style="padding:8px 12px;color:#212529"><a href="mailto:${data.email}">${data.email}</a></td>
          </tr>
          <tr style="background:#f9fafb">
            <td style="padding:8px 12px;font-weight:bold;color:#494949;vertical-align:top">Mensagem</td>
            <td style="padding:8px 12px;color:#212529;white-space:pre-line">${data.message}</td>
          </tr>
        </table>
        <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
        <p style="font-size:12px;color:#9ca3af">Enviado pelo formulario do site</p>
      </div>
    `,
  });
}
