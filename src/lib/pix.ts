// Monta o "Pix Copia e Cola" (BR Code / padrão EMV® do Banco Central) para uma
// venda, com o valor exato. A string resultante é o que vira QR Code e também
// pode ser copiada pelo cliente. Tudo é calculado no app — não depende do
// backend nem de internet — então funciona offline e via atualização OTA.

// Dados do recebedor vêm de fora (cada pessoa cadastra os seus — ver
// pix-config.ts). Nada aqui é chumbado: sem chave + nome, não gera o Pix.
export interface PixRecebedor {
  // Chave já normalizada para o BR Code (telefone em E.164, CPF/CNPJ só dígitos…).
  chave: string;
  // Nome do recebedor (aparece no app do cliente).
  nome: string;
  cidade?: string | null;
}

// Identificador da venda (txid): só letras e números, até 25. Neutro (marca).
const TXID_PADRAO = "Padoka100";

// Remove acentos e limita ao conjunto de caracteres seguro do padrão EMV.
// Nome e cidade viram ASCII para o comprimento do campo bater em bytes.
function toAscii(value: string): string {
  // NFD separa a letra do acento; o filtro seguinte remove tudo fora do
  // ASCII imprimivel (incluindo os acentos ja separados).
  return value.normalize("NFD").replace(/[^ -~]/g, "");
}

// txid: apenas [A-Za-z0-9], no máximo 25 caracteres.
function sanitizeTxid(value: string): string {
  const cleaned = toAscii(value).replace(/[^A-Za-z0-9]/g, "");
  return cleaned.slice(0, 25) || "***";
}

// Campo TLV: id (2) + tamanho (2 dígitos) + valor.
function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

// CRC16-CCITT (polinômio 0x1021, inicial 0xFFFF) — exigido pelo padrão Pix.
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// Valor no formato do padrão: ponto decimal, duas casas, sem separador de milhar.
function formatAmount(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2);
}

export interface PixInput {
  amount: number;
  recebedor: PixRecebedor;
  txid?: string;
  descricao?: string | null;
}

// Gera a string "copia e cola". Lança erro se o valor não for positivo ou se o
// recebedor não estiver configurado (chave + nome) — sem isso, não há Pix.
export function buildPixPayload({ amount, recebedor, txid, descricao }: PixInput): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Valor inválido para o Pix.");
  }
  const chave = (recebedor?.chave || "").trim();
  const nomeRecebedor = (recebedor?.nome || "").trim();
  if (!chave || !nomeRecebedor) {
    throw new Error("Configure sua chave Pix e o nome do recebedor.");
  }

  const nome = toAscii(nomeRecebedor).slice(0, 25) || "RECEBEDOR";
  const cidade = toAscii(recebedor.cidade || "").slice(0, 15) || "BRASIL";
  const info = descricao ? toAscii(descricao).slice(0, 72) : null;

  // Merchant Account Information (26): GUI + chave + info adicional opcional.
  const merchantAccount =
    tlv("00", "br.gov.bcb.pix") + tlv("01", chave) + (info ? tlv("02", info) : "");

  const additionalData = tlv("05", sanitizeTxid(txid ?? TXID_PADRAO));

  const payload =
    tlv("00", "01") +
    tlv("26", merchantAccount) +
    tlv("52", "0000") + // Merchant Category Code (não informado)
    tlv("53", "986") + // Moeda: BRL
    tlv("54", formatAmount(amount)) +
    tlv("58", "BR") + // País
    tlv("59", nome) +
    tlv("60", cidade) +
    tlv("62", additionalData);

  const withCrcId = `${payload}6304`;
  return `${withCrcId}${crc16(withCrcId)}`;
}
