// Monta o "Pix Copia e Cola" (BR Code / padrão EMV® do Banco Central) para uma
// venda, com o valor exato. A string resultante é o que vira QR Code e também
// pode ser copiada pelo cliente. Tudo é calculado no app — não depende do
// backend nem de internet — então funciona offline e via atualização OTA.

// Dados do recebedor. Ficam aqui no front por enquanto (o backend ainda não tem
// cadastro de conta Pix); se um dia virar configurável por padoca, é só trocar
// esta constante por um valor vindo da API.
export const PIX_RECEBEDOR = {
  // Chave Pix é um telefone: no BR Code precisa vir em formato E.164
  // (+55 + DDD + número). O telefone informado foi 11981090986.
  chave: "+5511981090986",
  chaveExibicao: "(11) 98109-0986",
  nome: "Filipe Boddenberg Ribeiro",
  cidade: "São Paulo",
  // Identificador da venda (txid): só aceita letras e números, até 25.
  txid: "Padoka100",
  // Texto livre mostrado em alguns apps de banco (informação adicional).
  descricao: "Paes e Doces Padoka100"
} as const;

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
  txid?: string;
  descricao?: string | null;
}

// Gera a string "copia e cola". Lança erro se o valor não for positivo — não
// faz sentido cobrar zero.
export function buildPixPayload({ amount, txid, descricao }: PixInput): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Valor inválido para o Pix.");
  }

  const nome = toAscii(PIX_RECEBEDOR.nome).slice(0, 25);
  const cidade = toAscii(PIX_RECEBEDOR.cidade).slice(0, 15) || "BRASIL";
  const info = descricao === undefined ? PIX_RECEBEDOR.descricao : descricao;

  // Merchant Account Information (26): GUI + chave + info adicional opcional.
  const merchantAccount =
    tlv("00", "br.gov.bcb.pix") + tlv("01", PIX_RECEBEDOR.chave) + (info ? tlv("02", toAscii(info).slice(0, 72)) : "");

  const additionalData = tlv("05", sanitizeTxid(txid ?? PIX_RECEBEDOR.txid));

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
