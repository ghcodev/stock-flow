import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Maximize2, Play, RefreshCw, RotateCw } from 'lucide-react'
import Layout from '../components/Layout.jsx'
import api from '../api/axios.js'
import { rotuloArmazenagem, codigoLocalizacao } from '../constants/armazenagem.js'
import { montarLayout, CELL_X } from '../constants/layoutArmazem3D.js'

const INTERVALO_MS = 5000
const DURACAO_MS = 2600
const ESPERA_MS = 700

const STATUS = {
  bloqueado: { label: 'Bloqueado ou vencido', token: '--color-danger-500' },
  quarentena: { label: 'Quarentena', token: '--color-info-600' },
  vencendo: { label: 'Vence em até 30 dias', token: '--color-warning-500' },
  ativo: { label: 'Ativo', token: '--color-success-500' },
}
const ORDEM_STATUS = Object.keys(STATUS)

const BADGE_TIPO = {
  entrada: 'badge-success',
  saida: 'badge-danger',
  transferencia: 'badge-info',
}

function cssVar(nome) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim()
}

function temaAtual() {
  return document.documentElement.dataset.theme || 'light'
}

function statusDoLote(lote) {
  const bruto = String(lote.status_lote || '').toLowerCase()
  const dias = lote.dias_para_vencer == null ? null : Number(lote.dias_para_vencer)
  if (bruto.includes('bloq') || bruto.includes('venc') || (dias != null && dias < 0)) return 'bloqueado'
  if (bruto.includes('quar')) return 'quarentena'
  if (dias != null && dias <= 30) return 'vencendo'
  return 'ativo'
}

function formatarData(valor) {
  return valor ? new Date(valor).toLocaleDateString('pt-BR') : '—'
}

function formatarHora(valor) {
  return valor ? new Date(valor).toLocaleTimeString('pt-BR') : '—'
}

function criarRotulo(texto, cor) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 96
  const ctx = canvas.getContext('2d')
  ctx.font = `600 44px ${getComputedStyle(document.body).fontFamily}`
  ctx.fillStyle = cor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(texto, 256, 48)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false }))
  sprite.scale.set(8, 1.5, 1)
  return sprite
}

function descartar(objeto) {
  objeto.traverse(item => {
    item.geometry?.dispose()
    const materiais = Array.isArray(item.material) ? item.material : [item.material]
    materiais.forEach(material => {
      material?.map?.dispose()
      material?.dispose()
    })
  })
}

export default function Armazem3D() {
  const telaRef = useRef(null)
  const cenaRef = useRef(null)
  const tresRef = useRef(null)
  const ultimoIdRef = useRef(null)

  const [localizacoes, setLocalizacoes] = useState([])
  const [lotes, setLotes] = useState([])
  const [feed, setFeed] = useState([])
  const [selecionado, setSelecionado] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [semConexao, setSemConexao] = useState(false)
  const [girar, setGirar] = useState(false)
  const [tema, setTema] = useState(temaAtual)

  const layout = useMemo(() => montarLayout(localizacoes), [localizacoes])

  const lotesPorLocal = useMemo(() => {
    const mapa = new Map()
    for (const lote of lotes) {
      if (!(Number(lote.quantidade) > 0)) continue
      const id = String(lote.id_localizacao)
      if (!mapa.has(id)) mapa.set(id, [])
      mapa.get(id).push(lote)
    }
    return mapa
  }, [lotes])

  const carregarLotes = useCallback(async () => {
    const todos = []
    for (let page = 1; ; page++) {
      const { data } = await api.get('/lotes', { params: { limit: 500, page } })
      todos.push(...data.data)
      if (!data.data.length || todos.length >= data.total) break
    }
    setLotes(todos)
  }, [])

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      const [{ data }] = await Promise.all([api.get('/localizacoes'), carregarLotes()])
      setLocalizacoes(data)
    } catch {
      setErro('Não foi possível carregar o armazém. Verifique a conexão e tente novamente.')
    } finally {
      setCarregando(false)
    }
  }, [carregarLotes])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    const observador = new MutationObserver(() => setTema(temaAtual()))
    observador.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observador.disconnect()
  }, [])

  useEffect(() => {
    const alvo = cenaRef.current
    if (!alvo || !layout.galpoes.length) return undefined

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true })
    } catch {
      setErro('Este navegador não oferece suporte a WebGL, necessário para a visualização 3D.')
      return undefined
    }
    const cor = token => new THREE.Color(cssVar(token))

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.domElement.setAttribute('role', 'img')
    renderer.domElement.setAttribute('aria-label', 'Visualização 3D dos galpões e das posições de armazenagem')
    alvo.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = cor('--color-bg-canvas')
    scene.add(new THREE.AmbientLight(undefined, 1.6))
    const sol = new THREE.DirectionalLight(undefined, 1.8)
    sol.position.set(20, 40, 25)
    scene.add(sol)

    const alcance = Math.max(layout.largura, layout.profundidade, 12)
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, alcance * 20)
    camera.position.set(alcance * 0.25, alcance * 0.5, alcance * 0.85)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 1.5, 0)
    controls.enableDamping = true
    controls.maxPolarAngle = Math.PI / 2 - 0.05
    controls.maxDistance = alcance * 4

    const mundo = new THREE.Group()
    mundo.position.set(-layout.largura / 2, 0, -layout.profundidade / 2)
    scene.add(mundo)

    const matPiso = new THREE.MeshLambertMaterial({ color: cor('--color-bg-elevated') })
    const matCasca = new THREE.MeshBasicMaterial({ color: cor('--color-brand-500'), transparent: true, opacity: 0.07, side: THREE.BackSide, depthWrite: false })
    const matLinha = new THREE.LineBasicMaterial({ color: cor('--color-border-strong') })
    const matEstante = new THREE.MeshLambertMaterial({ color: cor('--color-border-strong') })
    const postes = []

    for (const galpao of layout.galpoes) {
      const piso = new THREE.Mesh(new THREE.BoxGeometry(galpao.largura, 0.1, galpao.profundidade), matPiso)
      piso.position.set(galpao.x, -0.05, galpao.z)
      const caixa = new THREE.BoxGeometry(galpao.largura, galpao.altura, galpao.profundidade)
      const casca = new THREE.Mesh(caixa, matCasca)
      const contorno = new THREE.LineSegments(new THREE.EdgesGeometry(caixa), matLinha)
      casca.position.set(galpao.x, galpao.altura / 2, galpao.z)
      contorno.position.copy(casca.position)
      const rotulo = criarRotulo(galpao.nome, cssVar('--color-text-secondary'))
      rotulo.position.set(galpao.x, galpao.altura + 1.2, galpao.z + galpao.profundidade / 2)
      mundo.add(piso, casca, contorno, rotulo)

      for (const z of galpao.corredoresZ) {
        for (const x of galpao.colunasX) {
          postes.push([x, galpao.alturaEstante, z - 0.5], [x, galpao.alturaEstante, z + 0.5])
        }
      }
    }

    const matriz = new THREE.Matrix4()
    const malhaPostes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 1, 0.08), matEstante, postes.length)
    postes.forEach(([x, altura, z], i) => malhaPostes.setMatrixAt(i, matriz.makeScale(1, altura, 1).setPosition(x, altura / 2, z)))
    const malhaPrateleiras = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL_X, 0.06, 1), matEstante, layout.posicoes.size)
    let indice = 0
    for (const p of layout.posicoes.values()) {
      malhaPrateleiras.setMatrixAt(indice++, matriz.makeTranslation(p.x, p.y - 0.45, p.z))
    }
    mundo.add(malhaPostes, malhaPrateleiras)

    const paletes = new THREE.Group()
    const geoPalete = new THREE.BoxGeometry(CELL_X * 0.82, 0.8, 0.85)
    const selecao = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(CELL_X, 1.05, 1.1)),
      new THREE.LineBasicMaterial({ color: cor('--color-text-primary') })
    )
    selecao.visible = false
    mundo.add(paletes, selecao)

    const tres = {
      mundo,
      paletes,
      selecao,
      controls,
      geoPalete,
      materiais: Object.fromEntries(ORDEM_STATUS.map(status => [status, new THREE.MeshLambertMaterial({ color: cor(STATUS[status].token) })])),
      matMovimento: new THREE.MeshLambertMaterial({ color: cor('--color-brand-500'), emissive: cor('--color-brand-600'), emissiveIntensity: 0.6 }),
      movimentos: [],
    }
    tresRef.current = tres

    const ajustarTamanho = () => {
      const { clientWidth, clientHeight } = alvo
      if (!clientWidth || !clientHeight) return
      renderer.setSize(clientWidth, clientHeight)
      camera.aspect = clientWidth / clientHeight
      camera.updateProjectionMatrix()
    }
    const observador = new ResizeObserver(ajustarTamanho)
    observador.observe(alvo)
    ajustarTamanho()

    const raio = new THREE.Raycaster()
    let toque = null
    const aoPressionar = evento => { toque = { x: evento.clientX, y: evento.clientY } }
    const aoSoltar = evento => {
      // Arrastar gira a câmera; só um clique parado seleciona.
      if (!toque || Math.hypot(evento.clientX - toque.x, evento.clientY - toque.y) > 4) return
      const area = renderer.domElement.getBoundingClientRect()
      const ponto = new THREE.Vector2(
        ((evento.clientX - area.left) / area.width) * 2 - 1,
        -((evento.clientY - area.top) / area.height) * 2 + 1
      )
      raio.setFromCamera(ponto, camera)
      const [alvoClicado] = raio.intersectObjects(paletes.children)
      setSelecionado(alvoClicado ? alvoClicado.object.userData.id : null)
    }
    renderer.domElement.addEventListener('pointerdown', aoPressionar)
    renderer.domElement.addEventListener('pointerup', aoSoltar)

    let quadro
    const desenhar = agora => {
      quadro = requestAnimationFrame(desenhar)
      tres.movimentos = tres.movimentos.filter(movimento => {
        const t = (agora - movimento.inicio) / DURACAO_MS
        if (t < 0) return true
        if (t >= 1) {
          mundo.remove(movimento.mesh)
          return false
        }
        const suave = t * t * (3 - 2 * t)
        movimento.mesh.visible = true
        movimento.mesh.position.lerpVectors(movimento.de, movimento.para, suave)
        movimento.mesh.position.y += Math.sin(Math.PI * suave) * 3
        return true
      })
      controls.update()
      renderer.render(scene, camera)
    }
    quadro = requestAnimationFrame(desenhar)

    return () => {
      cancelAnimationFrame(quadro)
      observador.disconnect()
      controls.dispose()
      descartar(scene)
      geoPalete.dispose()
      tres.matMovimento.dispose()
      Object.values(tres.materiais).forEach(material => material.dispose())
      renderer.dispose()
      renderer.domElement.remove()
      tresRef.current = null
    }
  }, [layout, tema])

  useEffect(() => {
    const tres = tresRef.current
    if (!tres) return
    tres.paletes.clear()
    for (const [id, lista] of lotesPorLocal) {
      const p = layout.posicoes.get(id)
      if (!p) continue
      const status = ORDEM_STATUS.find(chave => lista.some(lote => statusDoLote(lote) === chave))
      const mesh = new THREE.Mesh(tres.geoPalete, tres.materiais[status])
      mesh.position.set(p.x, p.y, p.z)
      mesh.userData.id = id
      tres.paletes.add(mesh)
    }
  }, [lotesPorLocal, layout, tema])

  useEffect(() => {
    const tres = tresRef.current
    if (!tres) return
    const p = selecionado && layout.posicoes.get(selecionado)
    tres.selecao.visible = Boolean(p)
    if (p) tres.selecao.position.set(p.x, p.y, p.z)
    tres.controls.autoRotate = girar
    tres.controls.autoRotateSpeed = 0.8
  }, [selecionado, girar, layout, tema])

  const animar = useCallback((mov, atraso = 0) => {
    const tres = tresRef.current
    if (!tres) return
    // Ponta sem localização gravada: usa a posição do lote; entrada parte da doca e saída termina nela.
    // Ajuste e inventário sobem e descem na própria posição do lote.
    const localDoLote = lotes.find(lote => lote.id === mov.id_lote)?.id_localizacao
    const origem = layout.posicoes.get(String(mov.id_localizacao_origem ?? (mov.tipo === 'entrada' ? '' : localDoLote)))
    const destino = layout.posicoes.get(String(mov.id_localizacao_destino ?? (mov.tipo === 'saida' ? '' : localDoLote)))
    if (!origem && !destino) return
    const de = origem || destino.galpao.doca
    const para = destino || origem.galpao.doca
    const mesh = new THREE.Mesh(tres.geoPalete, tres.matMovimento)
    mesh.visible = false
    tres.mundo.add(mesh)
    tres.movimentos.push({
      mesh,
      de: new THREE.Vector3(de.x, de.y, de.z),
      para: new THREE.Vector3(para.x, para.y, para.z),
      inicio: performance.now() + atraso,
    })
  }, [layout, lotes])

  const animarRef = useRef(animar)
  animarRef.current = animar

  useEffect(() => {
    let ativo = true
    let recarga
    const buscar = async () => {
      try {
        const { data } = await api.get('/movimentacoes', { params: { limit: 20 } })
        if (!ativo) return
        const lista = data.data
        setFeed(lista)
        setSemConexao(false)
        if (ultimoIdRef.current != null) {
          const novas = lista.filter(mov => mov.id > ultimoIdRef.current).reverse()
          novas.forEach((mov, i) => animarRef.current(mov, i * ESPERA_MS))
          if (novas.length) {
            recarga = setTimeout(() => carregarLotes().catch(() => setSemConexao(true)), DURACAO_MS + novas.length * ESPERA_MS)
          }
        }
        ultimoIdRef.current = lista.reduce((maior, mov) => Math.max(maior, mov.id), ultimoIdRef.current ?? 0)
      } catch {
        if (ativo) setSemConexao(true)
      }
    }
    buscar()
    const timer = setInterval(buscar, INTERVALO_MS)
    return () => {
      ativo = false
      clearInterval(timer)
      clearTimeout(recarga)
    }
  }, [carregarLotes])

  function reproduzir() {
    feed.slice(0, 10).reverse().forEach((mov, i) => animar(mov, i * ESPERA_MS))
  }

  function alternarTelaCheia() {
    if (document.fullscreenElement) document.exitFullscreen()
    else telaRef.current?.requestFullscreen()
  }

  const total = layout.posicoes.size
  const ocupadas = [...lotesPorLocal.keys()].filter(id => layout.posicoes.has(id)).length
  const ocupacao = total ? Math.round((ocupadas / total) * 100) : 0
  const locaisOcupados = localizacoes.filter(loc => lotesPorLocal.has(String(loc.id)))
  const localSelecionado = selecionado ? localizacoes.find(loc => String(loc.id) === selecionado) : null
  const lotesSelecionados = selecionado ? lotesPorLocal.get(selecionado) || [] : []

  return (
    <Layout breadcrumb={['Operação', 'Armazém 3D']}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Armazém 3D</h1>
          <div className="subtitle">
            <span>{layout.galpoes.length} {layout.galpoes.length === 1 ? 'galpão' : 'galpões'}</span>
            <span className="sep" />
            {semConexao
              ? <span className="badge badge-danger" role="status">Sem conexão com o servidor</span>
              : <><span className="live-dot" /><span>Movimentações atualizadas a cada {INTERVALO_MS / 1000}s</span></>}
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={reproduzir} disabled={!feed.length}><Play size={14} /> Reproduzir últimas</button>
          <button className="btn btn-outline btn-sm" onClick={() => setGirar(valor => !valor)} aria-pressed={girar}><RotateCw size={14} /> Girar</button>
          <button className="btn btn-outline btn-sm" onClick={alternarTelaCheia}><Maximize2 size={14} /> Tela cheia</button>
          <button className="btn btn-outline btn-sm" onClick={carregar} disabled={carregando}><RefreshCw size={14} /> Atualizar</button>
        </div>
      </div>

      <div className="a3d-kpis">
        <div><span>Posições ocupadas</span><strong>{ocupadas}</strong></div>
        <div><span>Posições livres</span><strong>{total - ocupadas}</strong></div>
        <div><span>Capacidade total</span><strong>{total}</strong></div>
        <div><span>Ocupação</span><strong>{ocupacao}%</strong></div>
      </div>

      <div ref={telaRef} className="a3d-tela">
        <div className="a3d-cena card">
          <div ref={cenaRef} className="a3d-canvas" />
          {(erro || (!carregando && !total)) && (
            <div className="empty-state a3d-aviso">
              <span>{erro || 'Nenhuma localização cadastrada.'}</span>
              {erro && <button className="btn btn-outline btn-sm" onClick={carregar}>Tentar novamente</button>}
            </div>
          )}
          <ul className="a3d-legenda" aria-label="Legenda de status">
            {ORDEM_STATUS.map(status => (
              <li key={status}><i style={{ background: `var(${STATUS[status].token})` }} />{STATUS[status].label}</li>
            ))}
            <li><i style={{ background: 'var(--color-brand-500)' }} />Em movimento</li>
          </ul>
        </div>

        <aside className="a3d-lateral">
          <div>
            <label className="form-label" htmlFor="a3d-posicao">Posição ocupada</label>
            <select
              id="a3d-posicao"
              className="select"
              value={selecionado || ''}
              onChange={evento => setSelecionado(evento.target.value || null)}
            >
              <option value="">Selecione uma posição</option>
              {locaisOcupados.map(loc => (
                <option key={loc.id} value={String(loc.id)}>{codigoLocalizacao(loc)}</option>
              ))}
            </select>
          </div>
          {localSelecionado && (
            <section className="card">
              <div className="card-header">
                <span className="card-title">Posição {codigoLocalizacao(localSelecionado)}</span>
                <span className="badge badge-neutral">{rotuloArmazenagem(localSelecionado.tipo_zona)}</span>
              </div>
              <ul className="a3d-lista">
                {lotesSelecionados.map(lote => (
                  <li key={lote.id}>
                    <strong>{lote.produto_nome}</strong>
                    <span>Lote {lote.numero_lote} · {Number(lote.quantidade)} un. · validade {formatarData(lote.data_validade)}</span>
                    <span>{STATUS[statusDoLote(lote)].label}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card a3d-feed">
            <div className="card-header">
              <span className="card-title">Movimentações ao vivo</span>
              <span className="badge badge-neutral">{feed.length}</span>
            </div>
            <ul className="a3d-lista" aria-live="polite">
              {!feed.length && <li><span>Nenhuma movimentação registrada.</span></li>}
              {feed.map(mov => (
                <li key={mov.id}>
                  <div className="a3d-linha">
                    <span className={`badge ${BADGE_TIPO[mov.tipo] || 'badge-neutral'}`}>{mov.tipo}</span>
                    <span>{formatarHora(mov.criado_em)}</span>
                  </div>
                  <strong>{mov.produto_nome || '—'}</strong>
                  <span>Lote {mov.numero_lote || '—'} · {Number(mov.quantidade)} un.</span>
                  <span>{mov.localizacao_origem_nome || 'Doca'} → {mov.localizacao_destino_nome || 'Doca'} · {mov.usuario_nome || '—'}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      <style>{`
        .a3d-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
        .a3d-kpis > div { display: flex; flex-direction: column; gap: 2px; padding: 10px 14px; background: var(--color-bg-default); border: 1px solid var(--color-border-default); border-radius: var(--radius-lg); }
        .a3d-kpis span { font-size: 11px; color: var(--color-text-tertiary); }
        .a3d-kpis strong { font-size: 18px; color: var(--color-text-primary); }
        .a3d-tela { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; height: 620px; }
        .a3d-tela:fullscreen { height: auto; padding: 16px; background: var(--color-bg-canvas); }
        .a3d-cena { position: relative; overflow: hidden; min-height: 0; }
        .a3d-canvas { position: absolute; inset: 0; }
        .a3d-canvas canvas { display: block; cursor: grab; }
        .a3d-aviso { position: absolute; inset: 0; font-size: 13px; color: var(--color-text-secondary); background: var(--color-bg-default); }
        .a3d-legenda { position: absolute; left: 12px; bottom: 12px; display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 0; padding: 8px 12px; list-style: none; font-size: 11px; color: var(--color-text-secondary); background: var(--color-bg-default); border: 1px solid var(--color-border-default); border-radius: var(--radius-lg); }
        .a3d-legenda li { display: flex; align-items: center; gap: 6px; }
        .a3d-legenda i { width: 10px; height: 10px; border-radius: 2px; }
        .a3d-lateral { display: flex; flex-direction: column; gap: 16px; min-height: 0; }
        .a3d-feed { display: flex; flex-direction: column; flex: 1; min-height: 0; }
        .a3d-lista { margin: 0; padding: 0; list-style: none; overflow-y: auto; }
        .a3d-lista li { display: flex; flex-direction: column; gap: 2px; padding: 10px 16px; font-size: 12px; color: var(--color-text-secondary); border-bottom: 1px solid var(--color-border-muted); }
        .a3d-lista strong { font-size: 13px; color: var(--color-text-primary); }
        .a3d-linha { display: flex; align-items: center; justify-content: space-between; }
        @media (max-width: 1100px) {
          .a3d-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .a3d-tela { grid-template-columns: 1fr; height: auto; }
          .a3d-cena { height: 480px; }
          .a3d-feed { max-height: 360px; }
        }
      `}</style>
    </Layout>
  )
}
