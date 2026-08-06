import nodemailer from "nodemailer";

interface OrderNotificationData {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  items: { title: string; quantity: number; unitPrice: number }[];
  subtotal: number;
  shippingAmount: number;
  discountAmount: number;
  total: number;
  paymentMethod: string;
  pixQrCode?: string;
  boletoUrl?: string;
  boletoBarcode?: string;
  trackingCode?: string;
  storeName?: string;
  storeEmail?: string;
}

function getTransporter(config: {
  host: string; port: number; user: string; pass: string;
}) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  });
}

export async function sendOrderConfirmationEmail(
  data: OrderNotificationData,
  smtpConfig: { host: string; port: number; user: string; pass: string }
): Promise<void> {
  const transporter = getTransporter(smtpConfig);
  const paymentLabel: Record<string, string> = {
    pix: "PIX", boleto: "Boleto Bancário",
    credit_card: "Cartão de Crédito", debit_card: "Cartão de Débito"
  };

  const itemRows = data.items.map(i =>
    `<tr><td style="padding:8px;border-bottom:1px solid #eee">${i.title}</td>
     <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>
     <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">R$ ${i.unitPrice.toFixed(2)}</td>
     <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">R$ ${(i.unitPrice * i.quantity).toFixed(2)}</td></tr>`
  ).join("");

  const paymentSection = data.pixQrCode
    ? `<div style="margin:24px 0;padding:20px;background:#f0f9ff;border-radius:8px;text-align:center">
        <h3 style="color:#0369a1">Pague via PIX</h3>
        <img src="data:image/png;base64,${data.pixQrCode}" style="max-width:200px" alt="QR Code PIX"/>
        <p style="word-break:break-all;font-size:12px;background:#fff;padding:10px;border-radius:4px">${data.pixQrCode}</p>
        <p style="color:#dc2626;font-size:12px">PIX expira em 30 minutos</p>
       </div>`
    : data.boletoUrl
    ? `<div style="margin:24px 0;padding:20px;background:#fefce8;border-radius:8px;text-align:center">
        <h3 style="color:#854d0e">Pague seu Boleto</h3>
        <a href="${data.boletoUrl}" style="background:#854d0e;color:white;padding:12px 24px;border-radius:6px;text-decoration:none">Visualizar Boleto</a>
        ${data.boletoBarcode ? `<p style="font-size:12px;margin-top:10px">${data.boletoBarcode}</p>` : ""}
        <p style="color:#92400e;font-size:12px">Boleto vence em 3 dias úteis</p>
       </div>`
    : "";

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff">
      <div style="background:#2C3E50;color:white;padding:24px;text-align:center">
        <h1 style="margin:0;font-size:22px">${data.storeName || "Loja Virtual"}</h1>
        <p style="margin:8px 0 0">Pedido #${data.orderNumber}</p>
      </div>
      <div style="padding:24px">
        <h2 style="color:#2C3E50">Olá, ${data.customerName}!</h2>
        <p>Recebemos seu pedido com sucesso. Abaixo está o resumo:</p>
        ${paymentSection}
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <thead><tr style="background:#f8f8f8">
            <th style="padding:10px;text-align:left">Produto</th>
            <th style="padding:10px;text-align:center">Qtd</th>
            <th style="padding:10px;text-align:right">Unit.</th>
            <th style="padding:10px;text-align:right">Total</th>
          </tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div style="background:#f8f8f8;padding:16px;border-radius:6px">
          <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>R$ ${data.subtotal.toFixed(2)}</span></div>
          ${data.discountAmount > 0 ? `<div style="display:flex;justify-content:space-between;color:green"><span>Desconto</span><span>- R$ ${data.discountAmount.toFixed(2)}</span></div>` : ""}
          <div style="display:flex;justify-content:space-between"><span>Frete</span><span>${data.shippingAmount > 0 ? `R$ ${data.shippingAmount.toFixed(2)}` : "Grátis"}</span></div>
          <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:18px;margin-top:8px;padding-top:8px;border-top:2px solid #ddd">
            <span>Total</span><span>R$ ${data.total.toFixed(2)}</span>
          </div>
          <div style="margin-top:8px;color:#666;font-size:13px">Forma de pagamento: ${paymentLabel[data.paymentMethod] || data.paymentMethod}</div>
        </div>
        <p style="color:#666;font-size:13px;margin-top:24px">
          Dúvidas? Entre em contato: ${data.storeEmail || smtpConfig.user}
        </p>
      </div>
      <div style="background:#f8f8f8;padding:16px;text-align:center;color:#999;font-size:12px">
        ${data.storeName || "Loja Virtual"} &copy; ${new Date().getFullYear()}
      </div>
    </div>`;

  await transporter.sendMail({
    from: `"${data.storeName || "Loja Virtual"}" <${smtpConfig.user}>`,
    to: data.customerEmail,
    subject: `Pedido #${data.orderNumber} recebido${data.paymentMethod === "credit_card" ? " e confirmado" : " – aguardando pagamento"}!`,
    html,
  });
}

export async function sendShippingEmail(
  data: { orderNumber: string; customerName: string; customerEmail: string; trackingCode: string; carrier: string; storeName?: string },
  smtpConfig: { host: string; port: number; user: string; pass: string }
): Promise<void> {
  const transporter = getTransporter(smtpConfig);
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#2C3E50;color:white;padding:24px;text-align:center">
        <h1 style="margin:0">${data.storeName || "Loja Virtual"}</h1>
      </div>
      <div style="padding:24px">
        <h2>Seu pedido foi enviado! 📦</h2>
        <p>Olá <b>${data.customerName}</b>, seu pedido <b>#${data.orderNumber}</b> foi despachado.</p>
        <div style="background:#f0fdf4;padding:16px;border-radius:8px;margin:16px 0;text-align:center">
          <p style="margin:0;font-size:13px;color:#666">Código de rastreio</p>
          <p style="margin:8px 0;font-size:20px;font-weight:bold;font-family:monospace">${data.trackingCode}</p>
          <p style="margin:0;color:#666;font-size:13px">Transportadora: ${data.carrier}</p>
        </div>
        <p>Rastreie seu pedido no site dos Correios ou da transportadora.</p>
      </div>
    </div>`;

  await transporter.sendMail({
    from: `"${data.storeName || "Loja Virtual"}" <${smtpConfig.user}>`,
    to: data.customerEmail,
    subject: `Seu pedido #${data.orderNumber} foi enviado! 🚚`,
    html,
  });
}

// WhatsApp notification via Meta Cloud API
export async function sendWhatsAppMessage(
  to: string,
  templateName: string,
  parameters: string[],
  config: { phoneId: string; token: string }
): Promise<void> {
  const phone = to.replace(/\D/g, "").replace(/^0/, "55");
  await fetch(`https://graph.facebook.com/v18.0/${config.phoneId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: "pt_BR" },
        components: [{
          type: "body",
          parameters: parameters.map(v => ({ type: "text", text: v }))
        }]
      }
    }),
  }).catch(err => console.error("WhatsApp send error:", err));
}
