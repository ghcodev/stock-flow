import { execFileSync } from "node:child_process";
import net from "node:net";

const base = process.env.DEMO_URL ?? "https://localhost:8443";
const http = process.env.DEMO_HTTP_URL ?? "http://localhost:8080";
const senhaAdmin = process.env.DEMO_SENHA_ADMIN ?? "Admin@Demo2026";
const senhaOperador = process.env.DEMO_SENHA_OPERADOR ?? "Operador@Demo2026";

let falhas = 0;
function verificar(descricao, condicao, detalhe = "") {
  if (condicao) console.log(`ok     ${descricao}`);
  else {
    falhas += 1;
    console.log(`FALHA  ${descricao} ${detalhe}`);
  }
}

async function api(caminho, { metodo = "GET", token, corpo } = {}) {
  const resposta = await fetch(`${base}/api${caminho}`, {
    method: metodo,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(corpo ? { "Content-Type": "application/json" } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await resposta.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    json = null;
  }
  return { status: resposta.status, json, cabecalhos: resposta.headers };
}

function portaFechada(porta) {
  return new Promise((resolver) => {
    const socket = net.connect({ host: "127.0.0.1", port: porta, timeout: 1500 });
    socket.on("connect", () => {
      socket.destroy();
      resolver(false);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolver(true);
    });
    socket.on("error", () => resolver(true));
  });
}

const saude = await api("/health");
verificar("GET /api/health pelo Nginx em HTTPS", saude.status === 200 && saude.json?.status === "ok");

const redirecionamento = await fetch(`${http}/produtos?x=1`, { redirect: "manual" });
verificar("HTTP redireciona para HTTPS", redirecionamento.status === 301 && (redirecionamento.headers.get("location") ?? "").startsWith("https://"), redirecionamento.headers.get("location") ?? "");

const raiz = await fetch(`${base}/`);
const csp = raiz.headers.get("content-security-policy") ?? "";
verificar("CSP restrita sem unsafe-eval e com frame-ancestors none", csp.includes("default-src 'self'") && csp.includes("connect-src 'self'") && !csp.includes("unsafe-eval") && csp.includes("frame-ancestors 'none'"), csp);
verificar("X-Content-Type-Options nosniff", raiz.headers.get("x-content-type-options") === "nosniff");
verificar("Referrer-Policy presente", (raiz.headers.get("referrer-policy") ?? "") !== "");
verificar("Permissions-Policy libera serial só para self", (raiz.headers.get("permissions-policy") ?? "").includes("serial=(self)"));
verificar("HSTS no HTTPS", (raiz.headers.get("strict-transport-security") ?? "").includes("max-age"));
verificar("index.html sem cache", (raiz.headers.get("cache-control") ?? "").includes("no-cache"));
const html = await raiz.text();
const arquivoJs = /\/assets\/[^"']+\.js/.exec(html)?.[0];
verificar("index.html referencia um pacote JS com hash", arquivoJs !== undefined);
if (arquivoJs) {
  const ativo = await fetch(`${base}${arquivoJs}`);
  verificar("asset com cache longo e imutável", (ativo.headers.get("cache-control") ?? "").includes("immutable"));
  verificar("asset com gzip", ativo.headers.get("content-encoding") === "gzip");
  verificar("asset também com cabeçalhos de segurança", (ativo.headers.get("content-security-policy") ?? "") !== "");
  await ativo.arrayBuffer();
}
const spa = await fetch(`${base}/produtos`);
verificar("rota do SPA devolve o index.html", spa.status === 200 && (await spa.text()).includes("raiz"));
const inexistente = await fetch(`${base}/assets/nao-existe.js`);
verificar("asset inexistente dá 404 (não cai no index)", inexistente.status === 404);
const spoof = await fetch(`${base}/api/health`, { headers: { "X-Forwarded-For": "1.2.3.4" } });
verificar("X-Forwarded-For do cliente não derruba a API", spoof.status === 200);

const loginAdmin = await api("/auth/login", { metodo: "POST", corpo: { email: "carlos.matos@stockflow.demo", senha: senhaAdmin } });
const loginOperador = await api("/auth/login", { metodo: "POST", corpo: { email: "joao.almeida@stockflow.demo", senha: senhaOperador } });
verificar("login do administrador", loginAdmin.status === 200 && loginAdmin.json?.usuario?.perfil === "administrador");
verificar("login do operador", loginOperador.status === 200 && loginOperador.json?.usuario?.perfil === "operador");
const tokenAdmin = loginAdmin.json?.token;
const tokenOperador = loginOperador.json?.token;

const leituras = ["/dashboard", "/produtos?limite=5", "/lotes?limite=5", "/mapa?limite=5", "/movimentacoes?limite=5", "/alertas/vencimento?limite=5", "/inventario/contagens?limite=5", "/localizacoes?limite=5"];
for (const caminho of leituras) {
  const r = await api(caminho, { token: tokenOperador });
  verificar(`leitura ${caminho} como operador`, r.status === 200);
}
for (const caminho of ["/auditoria?limite=5", "/usuarios?limite=5"]) {
  const r = await api(caminho, { token: tokenAdmin });
  verificar(`leitura ${caminho} como administrador`, r.status === 200);
  const negado = await api(caminho, { token: tokenOperador });
  verificar(`${caminho} negado ao operador`, negado.status === 403);
}

const painel = await api("/dashboard", { token: tokenOperador });
verificar("dashboard traz data_referencia, gráfico e indicadores", typeof painel.json?.data_referencia === "string" && Array.isArray(painel.json?.grafico) && painel.json?.indicadores?.produtos > 0);

const lista = await api("/lotes?status=ativo&limite=50", { token: tokenOperador });
const lote = lista.json?.dados?.find((l) => Number(l.quantidade) >= 5);
verificar("há lote ativo com saldo para a entrada e a saída", lote !== undefined);
if (lote) {
  const rastro = await api(`/rastreabilidade?numero_lote=${encodeURIComponent(lote.numero_lote)}`, { token: tokenOperador });
  verificar("rastreabilidade do lote", rastro.status === 200 && rastro.json?.linha_do_tempo?.length > 0);
  const antes = lote.quantidade;
  const entrada = await api("/movimentacoes/entrada", { metodo: "POST", token: tokenOperador, corpo: { id_lote: lote.id_lote, quantidade: "2", motivo: "Teste de fumaça" } });
  verificar("entrada registrada", entrada.status === 201 && Number(entrada.json?.saldo_posterior) === Number(antes) + 2, JSON.stringify(entrada.json)?.slice(0, 120));
  const saida = await api("/movimentacoes/saida", { metodo: "POST", token: tokenOperador, corpo: { id_lote: lote.id_lote, quantidade: "2", motivo: "Teste de fumaça" } });
  verificar("saída registrada e saldo volta ao original", saida.status === 201 && Number(saida.json?.saldo_posterior) === Number(antes), JSON.stringify(saida.json)?.slice(0, 120));
}

function publicadas() {
  const saida = execFileSync("docker", ["compose", "-p", "stockflow-demo", "ps", "--format", "json"], { encoding: "utf8" });
  const linhas = saida.split(/\r?\n/).filter((l) => l.trim() !== "").map((l) => JSON.parse(l));
  return Object.fromEntries(linhas.map((l) => [l.Service, (l.Publishers ?? []).filter((p) => p.PublishedPort > 0).map((p) => p.PublishedPort)]));
}
const portas = publicadas();
verificar("API sem porta publicada no host (só rede interna)", (portas.api ?? []).length === 0, JSON.stringify(portas));
verificar("banco sem porta publicada no host", (portas.postgres ?? []).length === 0, JSON.stringify(portas));
verificar("Nginx é a única porta publicada (80 e 443 internos)", (portas.web ?? []).length === 2, JSON.stringify(portas));
const aberta3000 = !(await portaFechada(3000));
console.log(aberta3000 ? "aviso  a porta 3000 do host responde, mas é outro processo (a API da demonstração não publica porta)" : "ok     porta 3000 do host fechada");
verificar("porta 5432 do host fechada", await portaFechada(5432));

console.log(falhas === 0 ? "\nFUMAÇA: TUDO OK" : `\nFUMAÇA: ${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 1 - 1 : 1);
