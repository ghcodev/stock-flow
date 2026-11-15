const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
const COMPLETO = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,3})?)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/;
const UM_DIA_MS = 24 * 60 * 60 * 1000;
const ANO_MINIMO = 1900;

export type Instante = { momento: Date; diaInteiro: boolean };

function diaExiste(ano: number, mes: number, dia: number): boolean {
  if (ano < ANO_MINIMO) return false;
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

export function lerInstante(texto: string): Instante | null {
  const soData = SO_DATA.exec(texto);
  if (soData) {
    const [ano, mes, dia] = [Number(soData[1]), Number(soData[2]), Number(soData[3])];
    return diaExiste(ano, mes, dia) ? { momento: new Date(Date.UTC(ano, mes - 1, dia)), diaInteiro: true } : null;
  }
  const completo = COMPLETO.exec(texto);
  if (!completo || !diaExiste(Number(completo[1]), Number(completo[2]), Number(completo[3]))) return null;
  const momento = new Date(texto);
  return Number.isFinite(momento.getTime()) ? { momento, diaInteiro: false } : null;
}

export function inicioDoPeriodo(instante: Instante): Date {
  return instante.momento;
}

export function fimExclusivoDoPeriodo(instante: Instante): Date {
  return new Date(instante.momento.getTime() + (instante.diaInteiro ? UM_DIA_MS : 1));
}

export function periodoValido(de: Instante, ate: Instante): boolean {
  return inicioDoPeriodo(de).getTime() < fimExclusivoDoPeriodo(ate).getTime();
}
