const PADRAO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

const FORMATO_DIA = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
const FORMATO_DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function paraUtc(dia: string): number | null {
  const casamento = PADRAO_DIA.exec(dia);
  if (!casamento) return null;
  const [, ano, mes, diaDoMes] = casamento;
  const instante = Date.UTC(Number(ano), Number(mes) - 1, Number(diaDoMes));
  const data = new Date(instante);
  const confere = data.getUTCFullYear() === Number(ano) && data.getUTCMonth() === Number(mes) - 1 && data.getUTCDate() === Number(diaDoMes);
  return confere ? instante : null;
}

export function ehDiaValido(dia: string): boolean {
  return paraUtc(dia) !== null;
}

export function formatarDia(dia: string | null): string {
  if (dia === null) return "—";
  const instante = paraUtc(dia);
  return instante === null ? dia : FORMATO_DIA.format(new Date(instante));
}

export function formatarDataHora(iso: string | null): string {
  if (iso === null) return "—";
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? iso : FORMATO_DATA_HORA.format(data);
}

export function diaDeHoje(agora: Date = new Date()): string {
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

export function diasAte(dia: string, hoje: string): number | null {
  const alvo = paraUtc(dia);
  const base = paraUtc(hoje);
  if (alvo === null || base === null) return null;
  return Math.round((alvo - base) / 86_400_000);
}

export function compararDias(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}
