// src/utils/sendEmail.js
import emailjs from "@emailjs/browser";

// Initialise EmailJS
emailjs.init("FyEChC8hKsIlwS6ht");  // ta Public Key

const SERVICE_ID          = "service_djj3pmr";
const TEMPLATE_ID_CONTRACT = "template_z8uirlj";
const TEMPLATE_ID_SIGNED   = "template_aqjfqh6";

export function sendContractEmail({ nom, email, lien }) {
  return emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID_CONTRACT,
    { nom, email, link: lien }
  );
}

export function sendSignedContractEmail({ client_name, email, pdf_url }) {
  return emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID_SIGNED,
    { client_name, email, pdf_url }
  );
}
