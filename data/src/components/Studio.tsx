'use client';

import { useEffect, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp, Clapperboard, Code2, Copy, Film, ImagePlus, Layers3, Link2, LoaderCircle, Plus, RotateCcw, Save, Sparkles, WandSparkles, X } from 'lucide-react';
import { DEFAULT_BRAND, FORMATS, STYLES, type AIEngine, type Asset, type Brief, type ExportJob, type Motion, type Project, type Scene, type VideoSpec, specSchema } from '@/lib/spec';
import { sceneMotion } from '@/lib/motion';
import { DEMO_SPEC } from '@/lib/generator';
import { MotionVideo } from '@/remotion/MotionVideo';

const initialBrief: Brief = { url: '', prompt: '', format: '16:9', duration: 15, style: 'premium', brand: { ...DEFAULT_BRAND, name: 'Votre produit', description: '' }, assets: [] };
const styleLabels = { premium: 'Premium', tech: 'Tech', minimal: 'Minimal', dynamic: 'Dynamique' };
const familyLabels = { hook: 'Hook / typographie', feature: 'Produit / capture UI', cta: 'Bénéfice / CTA' };
async function api<T>(url: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await fetch(url, body === undefined ? { cache: 'no-store' } : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'La requête a échoué.'); return data as T;
}
function downloadJson(spec: VideoSpec) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'storyboard.json'; link.click(); URL.revokeObjectURL(url);
}
export default function Studio({ aiEngine, requestedProvider }: { aiEngine: AIEngine; requestedProvider: AIEngine }) {
  const aiEnabled = aiEngine !== 'local';
  const providerName = aiEngine === 'anthropic' || requestedProvider === 'anthropic' ? 'Claude' : 'OpenAI';
  const providerLabel = aiEnabled ? `${providerName} configuré · création personnalisée` : `Mode démo · ${requestedProvider === 'local' ? 'aucune clé requise' : `${providerName} à connecter`}`;
  const [brief, setBrief] = useState<Brief>(initialBrief);
  const [project, setProject] = useState<Project | null>(null);
  const [spec, setSpec] = useState<VideoSpec>(DEMO_SPEC);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState(0);
  const [pane, setPane] = useState<'brief' | 'edit'>('brief');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [instruction, setInstruction] = useState('');
  const [undo, setUndo] = useState<VideoSpec[]>([]);
  const [job, setJob] = useState<ExportJob | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [drag, setDrag] = useState(false);
  const [frame, setFrame] = useState(24);
  const [ready, setReady] = useState(false);
  const player = useRef<PlayerRef>(null); const input = useRef<HTMLInputElement>(null);
  const dimensions = FORMATS[spec.format]; const current = spec.scenes[selected] ?? spec.scenes[0];
  const currentMotion = sceneMotion(current, spec.style);
  const rendering = job && ['queued', 'rendering'].includes(job.status);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const id = new URLSearchParams(window.location.search).get('project') || localStorage.getItem('frame-project');
        if (id) {
          const restored = await api<Project>(`/api/projects/${encodeURIComponent(id)}`);
          if (!cancelled) { setProject(restored); setSpec(restored.spec); setBrief(restored.brief); setPane('edit'); localStorage.setItem('frame-project', restored.id); }
        } else {
          const draft = localStorage.getItem('frame-draft');
          if (draft && !cancelled) setBrief({ ...initialBrief, ...JSON.parse(draft) });
        }
        const exportId = localStorage.getItem('frame-export');
        if (exportId) { const restoredJob = await api<ExportJob>(`/api/exports/${exportId}`); if (!cancelled && restoredJob.projectId === id) setJob(restoredJob); }
      } catch { if (!cancelled) setNotice('Le dernier projet est indisponible. Vous pouvez en créer un nouveau.'); }
      finally { if (!cancelled) setReady(true); }
    }
    void restore(); return () => { cancelled = true; };
  }, []);
  useEffect(() => { if (ready) localStorage.setItem('frame-draft', JSON.stringify(brief)); }, [brief, ready]);
  useEffect(() => {
    if (!ready || !player.current) return;
    const ref = player.current; const listener = ({ detail }: { detail: { frame: number } }) => setFrame(detail.frame);
    ref.addEventListener('frameupdate', listener); return () => ref.removeEventListener('frameupdate', listener);
  }, [ready]);
  useEffect(() => {
    if (!job || !['queued', 'rendering'].includes(job.status)) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      try { const next = await api<ExportJob>(`/api/exports/${job.id}`); if (!cancelled) setJob(next); }
      catch (e) { if (!cancelled) setError((e as Error).message); }
    }, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [job?.id, job?.status]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);
  function accept(next: Project) { setProject(next); setSpec(next.spec); setDirty(false); localStorage.setItem('frame-project', next.id); window.history.replaceState({}, '', `/?project=${next.id}`); }
  async function act(label: string, work: () => Promise<void>) {
    setBusy(label); setError(''); try { await work(); } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  }
  async function generate(value = brief) {
    await act('Création du storyboard', async () => {
      const next = await api<Project>('/api/projects', value); accept(next); setBrief(next.brief); setSelected(0); setPane('edit'); setUndo([]); setInstruction(''); setJob(null); localStorage.removeItem('frame-export'); player.current?.seekTo(15); setNotice('Votre storyboard est prêt. Affinez les scènes, puis exportez.');
    });
  }
  async function save(): Promise<Project> {
    if (!project) throw new Error('Créez d’abord votre storyboard.');
    if (!dirty) return project;
    const next = await api<Project>(`/api/projects/${project.id}`, { spec: specSchema.parse(spec), revision: project.revision }, 'PUT'); accept(next); return next;
  }
  function change(next: VideoSpec) { setUndo(old => [...old, spec].slice(-20)); setSpec(next); setDirty(true); }
  function changeScene(field: keyof Scene, value: string | null) {
    change({ ...spec, scenes: spec.scenes.map((s, i) => i === selected ? { ...s, [field]: value } : s) });
  }
  function changeMotion<K extends keyof Motion>(field: K, value: Motion[K]) {
    change({ ...spec, scenes: spec.scenes.map((scene, i) => i === selected ? { ...scene, motion: { ...sceneMotion(scene, spec.style), [field]: value } } : scene) });
  }
  async function upload(files: File[]) {
    await act('Import des images', async () => {
      if (brief.assets.length + files.length > 10) throw new Error('Vous pouvez importer jusqu’à 10 images.');
      const form = new FormData(); files.forEach(f => form.append('files', f));
      const response = await fetch('/api/assets', { method: 'POST', body: form }); const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Import impossible.');
      setBrief(b => ({ ...b, assets: [...b.assets, ...(data.assets as Asset[])] })); setNotice('Images importées. Choisissez leur rôle ci-dessous.');
    });
  }
  async function patch() {
    await act('Retouche en cours', async () => {
      const saved = await save();
      const result = await api<{ project: Project; explanation: string }>(`/api/projects/${saved.id}`, { instruction, revision: saved.revision }, 'PATCH');
      setUndo(old => [...old, spec].slice(-20)); accept(result.project); setInstruction(''); setNotice(result.explanation || 'Retouche appliquée et sauvegardée.');
    });
  }
  async function exportVideo() {
    await act('Lancement de l’export', async () => {
      const saved = await save(); const next = await api<ExportJob>('/api/exports', { projectId: saved.id, revision: saved.revision });
      setJob(next); localStorage.setItem('frame-export', next.id);
    });
  }
  function selectScene(index: number) { setSelected(index); setPane('edit'); player.current?.pause(); player.current?.seekTo(spec.scenes.slice(0, index).reduce((n, s) => n + s.durationInFrames, 0) + 18); }
  function newProject() {
    setBrief(initialBrief); setProject(null); setSpec(DEMO_SPEC); setDirty(false); setSelected(0); setUndo([]); setPane('brief'); setJob(null); setError(''); localStorage.removeItem('frame-project'); localStorage.removeItem('frame-export'); window.history.replaceState({}, '', '/'); player.current?.pause(); player.current?.seekTo(0);
  }
  const disabled = !!busy || !ready;
  return <div className="studio">
    <aside className="rail"><a className="brand-symbol" href="/" aria-label="Frame, accueil"><Clapperboard size={23}/></a><button className="rail-active" title="Studio de création" aria-label="Studio de création"><Layers3 size={20}/></button><button title="Nouveau projet" aria-label="Nouveau projet" disabled={disabled || dirty} onClick={newProject}><Plus size={22}/></button><div className="rail-bottom"><a href="#help" title="Aide" aria-label="Aide"><CircleHelp size={20}/></a><span className="avatar">S</span></div></aside>
    <div className="workspace">
      <header className="topbar"><div className="wordmark">frame<span>®</span></div><div className="header-separator"/><div className="breadcrumb">Studio <span>/</span> <strong>{project ? spec.brand.name : 'Nouveau projet'}</strong><span className="beta">MVP</span></div><div className="top-actions"><span className="save-status"><span className={dirty ? 'dot amber' : 'dot'}/>{project ? dirty ? 'À sauvegarder' : 'Sauvegardé' : 'Brouillon local'}</span><button className="button dark small" disabled={disabled || !project || !!rendering} onClick={exportVideo}><ArrowDownToLine size={16}/>{rendering ? 'Export en cours' : 'Exporter la vidéo'}</button></div></header>
      <div className="studio-body">
        <aside className="control-panel">
          <div className="panel-tabs"><button className={pane === 'brief' ? 'active' : ''} onClick={() => setPane('brief')}>01 <span>Brief créatif</span></button><button className={pane === 'edit' ? 'active' : ''} disabled={!project} onClick={() => setPane('edit')}>02 <span>Affiner</span></button></div>
          <div className="panel-scroll">
            {pane === 'brief' ? <>
              <div className="section-intro"><span className="overline">DE L’IDÉE À L’ÉCRAN</span><h1>Votre produit.<br/><span>En mouvement.</span></h1><p>Un brief, vos visuels, et une vidéo qui raconte l’essentiel.</p></div>
              <fieldset disabled={disabled} className="fields">
                <label htmlFor="url">Votre site <span className="optional">facultatif</span></label><div className="url-row"><Link2 size={16}/><input id="url" value={brief.url} placeholder="https://votre-produit.com" onChange={e => setBrief({ ...brief, url: e.target.value })}/><button aria-label="Analyser le site" title="Analyser le nom, la description et la couleur du site" disabled={!brief.url.trim()} onClick={() => act('Analyse du site', async () => { const data = await api<{ brand: Brief['brand']; url: string }>('/api/brand', { url: brief.url }); setBrief(b => ({ ...b, brand: data.brand, url: data.url })); setNotice('Identité extraite du site. Vous pouvez la modifier.'); })}><ArrowRight size={18}/></button></div><p className="field-note">La flèche récupère le nom, la description et la couleur du site.</p>
                <div className="label-row"><label htmlFor="prompt">Décrivez votre vidéo <span className="tiny-spark">✧</span></label><span className="optional">Le point de départ</span></div><textarea id="prompt" className="brief-text" rows={5} value={brief.prompt} onChange={e => setBrief({ ...brief, prompt: e.target.value })} placeholder={'Ex. Une vidéo premium de 15 secondes pour lancer notre outil. Commence par « Les grandes idées commencent ici », zoome sur le dashboard, puis invite à essayer le produit.'}/>
                <div className="label-row"><label>Vos visuels</label><span className="optional">PNG, JPG, WebP</span></div>
                <button className={`upload-zone ${drag ? 'dragging' : ''}`} onClick={() => input.current?.click()} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); void upload([...e.dataTransfer.files]); }}><span className="upload-icon"><ImagePlus size={21}/></span><strong>Glissez vos images ici</strong><span>ou cliquez pour parcourir · 10 Mo / image</span></button><input ref={input} type="file" multiple accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Importer des images" onChange={e => { if (e.target.files) void upload([...e.target.files]); e.target.value = ''; }}/>
                {brief.assets.length > 0 && <div className="asset-list">{brief.assets.map(a => <div key={a.id} className="asset-row"><img src={a.src} alt={a.name}/><div><span title={a.name}>{a.name}</span><select aria-label={`Rôle de ${a.name}`} value={a.role} onChange={e => setBrief(b => ({ ...b, assets: b.assets.map(item => item.id === a.id ? { ...item, role: e.target.value as Asset['role'] } : item) }))}><option value="logo">Logo</option><option value="screenshot">Capture produit</option><option value="image">Image</option></select></div><button aria-label={`Retirer ${a.name}`} onClick={() => setBrief(b => ({ ...b, assets: b.assets.filter(item => item.id !== a.id) }))}><X size={14}/></button></div>)}</div>}
                <div className="two-fields"><div><label>Format</label><div className="segmented">{Object.keys(FORMATS).map(format => <button key={format} className={brief.format === format ? 'selected' : ''} onClick={() => setBrief({ ...brief, format: format as Brief['format'] })}><span className={`format-icon f-${format.replace(':', '')}`}/>{format}</button>)}</div></div><div><label>Durée</label><div className="segmented">{[8, 15, 30].map(duration => <button key={duration} className={brief.duration === duration ? 'selected' : ''} onClick={() => setBrief({ ...brief, duration: duration as Brief['duration'] })}>{duration}s</button>)}</div></div></div>
                <label>Direction artistique</label><div className="style-grid">{STYLES.map(style => <button key={style} className={`style-option ${brief.style === style ? 'selected' : ''}`} onClick={() => setBrief({ ...brief, style })}><span className={`style-swatch ${style}`}><i/><i/><i/></span><span>{styleLabels[style]}</span>{brief.style === style && <Check size={13}/>}</button>)}</div>
                <details className="brand-details"><summary>Identité de marque <ChevronDown size={14}/></summary><label htmlFor="brand-name">Nom du produit</label><input id="brand-name" maxLength={60} value={brief.brand.name} onChange={e => setBrief({ ...brief, brand: { ...brief.brand, name: e.target.value } })}/><label htmlFor="brand-description">Promesse du produit</label><textarea id="brand-description" maxLength={500} rows={2} value={brief.brand.description} onChange={e => setBrief({ ...brief, brand: { ...brief.brand, description: e.target.value } })}/><div className="color-row">{(['accent', 'background', 'foreground'] as const).map((key, i) => <label key={key}><input type="color" value={brief.brand[key]} onChange={e => setBrief({ ...brief, brand: { ...brief.brand, [key]: e.target.value } })}/>{['Accent', 'Fond', 'Texte'][i]}</label>)}</div></details>
              </fieldset>
              <button className="button primary generate" disabled={disabled || (!brief.prompt.trim() && !brief.url.trim() && !brief.assets.length)} onClick={() => generate()}>{busy ? <LoaderCircle className="spin" size={18}/> : <Sparkles size={18}/>} {busy || (project ? 'Créer un nouveau storyboard' : 'Créer mon storyboard')} {!busy && <ArrowRight size={17}/>}</button><p className="local-note"><span className="dot"/>{providerLabel}</p>
              <div id="help" className="help-card"><span>Un premier essai ?</span><button disabled={disabled} onClick={() => generate({ ...initialBrief, brand: DEFAULT_BRAND, prompt: '"Les grandes idées commencent ici." "Votre équipe. Un seul espace." Présente un outil de gestion de projets avec un zoom sur le dashboard et un CTA final.' })}>Essayer avec un brief exemple <ArrowUpRight size={14}/></button></div>
            </> : <>
              <div className="edit-intro"><span className="overline">LA TOUCHE FINALE</span><h2>Faites-en votre film.</h2><p>Modifiez les textes ou décrivez une retouche.</p></div>
              <p className="local-note"><span className="dot"/>{providerLabel}</p>
              {project?.creativePlan && <details className="creative-plan"><summary>Direction créative initiale <ChevronDown size={14}/></summary><strong>{project.creativePlan.centralMessage}</strong><p>{project.creativePlan.visualDirection}</p><dl><dt>Objectif</dt><dd>{project.creativePlan.objective}</dd><dt>Public</dt><dd>{project.creativePlan.audience}</dd><dt>Ton</dt><dd>{project.creativePlan.tone}</dd></dl>{project.creativePlan.warnings.map((warning, i) => <p className="creative-warning" key={i}>{warning}</p>)}</details>}
              <div className="retouch-card"><label htmlFor="instruction"><WandSparkles size={16}/> Retouche en langage naturel</label><textarea id="instruction" disabled={disabled} rows={3} value={instruction} onChange={e => setInstruction(e.target.value)} placeholder={'Ex. Accentue le zoom sur le dashboard et accélère les animations.'}/><div className="prompt-chips">{['Plus rapide', 'Accentue le zoom', 'Transition en fondu'].map(t => <button key={t} disabled={disabled} onClick={() => setInstruction(t)}>{t}</button>)}</div><button className="button primary" disabled={disabled || !instruction.trim()} onClick={patch}>{busy ? <LoaderCircle className="spin" size={16}/> : <Sparkles size={16}/>}Appliquer la retouche</button></div>
              <div className="scene-edit-heading"><span className="overline">SCÈNE {String(selected + 1).padStart(2, '0')}</span><span>{familyLabels[current.type]}</span></div>
              <fieldset disabled={disabled} className="fields scene-fields"><label htmlFor="scene-eyebrow">Surtitre</label><input id="scene-eyebrow" maxLength={60} value={current.eyebrow} onChange={e => changeScene('eyebrow', e.target.value)}/><label htmlFor="scene-title">Titre principal</label><textarea id="scene-title" rows={3} maxLength={100} value={current.title} onChange={e => changeScene('title', e.target.value)}/><label htmlFor="scene-body">Texte secondaire</label><textarea id="scene-body" rows={3} maxLength={200} value={current.body} onChange={e => changeScene('body', e.target.value)}/>
                {current.type === 'feature' && <><label htmlFor="scene-asset">Visuel du produit</label><select id="scene-asset" value={current.assetId || ''} onChange={e => changeScene('assetId', e.target.value || null)}><option value="">Interface de démonstration</option>{spec.assets.filter(a => a.role !== 'logo').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>{!current.assetId && <p className="field-note">Un exemple d’interface s’affiche en l’absence de capture.</p>}</>}
                {current.type === 'cta' && <><label htmlFor="scene-stat">Chiffre clé <span className="optional">facultatif</span></label><input id="scene-stat" maxLength={24} value={current.statistic} onChange={e => changeScene('statistic', e.target.value)} placeholder="Ex. 2×"/><label htmlFor="scene-cta">Appel à l’action</label><input id="scene-cta" maxLength={40} value={current.cta} onChange={e => changeScene('cta', e.target.value)}/></>}
                <div className="motion-controls"><div className="motion-controls-heading"><WandSparkles size={14}/><strong>Animation de la scène</strong></div>
                  <label htmlFor="scene-entrance">Apparition du titre</label><select id="scene-entrance" value={currentMotion.entrance} onChange={e => changeMotion('entrance', e.target.value as Motion['entrance'])}><option value="rise">Entrée montante</option><option value="reveal">Révélation mot par mot</option><option value="typewriter">Texte tapé</option></select>
                  <label htmlFor="scene-pace">Rythme</label><select id="scene-pace" value={currentMotion.pace} onChange={e => changeMotion('pace', e.target.value as Motion['pace'])}><option value="slow">Calme</option><option value="balanced">Équilibré</option><option value="fast">Rapide</option></select>
                  <label htmlFor="scene-transition">Transition vers cette scène</label><select id="scene-transition" disabled={disabled || selected === 0} value={currentMotion.transition} onChange={e => changeMotion('transition', e.target.value as Motion['transition'])}><option value="fade">Fondu</option><option value="slide">Glissement</option><option value="wipe">Balayage</option></select>
                  {current.type === 'feature' && <><label htmlFor="scene-zoom">Zoom progressif <output>{Math.round((currentMotion.zoom - 1) * 100)}%</output></label><input id="scene-zoom" type="range" min={1} max={1.35} step={.01} value={currentMotion.zoom} onChange={e => changeMotion('zoom', Number(e.target.value))}/><div className="focus-controls"><div><label htmlFor="scene-focus-x">Cadrage horizontal</label><input id="scene-focus-x" type="range" min={0} max={100} step={5} value={currentMotion.focusX} onChange={e => changeMotion('focusX', Number(e.target.value))}/></div><div><label htmlFor="scene-focus-y">Cadrage vertical</label><input id="scene-focus-y" type="range" min={0} max={100} step={5} value={currentMotion.focusY} onChange={e => changeMotion('focusY', Number(e.target.value))}/></div></div><p className="field-note">Le cadrage choisit le point autour duquel l’image zoome.</p></>}
                </div>
                <div className="color-row">{(['accent', 'background', 'foreground'] as const).map((key, i) => <label key={key}><input type="color" value={spec.brand[key]} onChange={e => change({ ...spec, brand: { ...spec.brand, [key]: e.target.value } })}/>{['Accent', 'Fond', 'Texte'][i]}</label>)}</div>
              </fieldset>
              <div className="edit-actions"><button className="button secondary" disabled={disabled || !undo.length} onClick={() => { setSpec(undo.at(-1)!); setUndo(undo.slice(0, -1)); setDirty(true); }}><RotateCcw size={15}/>Annuler</button><button className="button dark" disabled={disabled || !dirty} onClick={() => act('Sauvegarde', async () => { await save(); setNotice('Modifications sauvegardées.'); })}><Save size={15}/>Sauvegarder</button></div>
              {project?.history.length ? <details className="history"><summary>Historique des retouches ({project.history.length})</summary>{project.history.slice().reverse().map((item, i) => <p key={i}><Check size={13}/>{item.instruction}</p>)}</details> : null}
              <div id="help" className="help-card"><span>{aiEnabled ? 'Les demandes libres passent par l’IA.' : 'Le mode local comprend rythme, zoom, transitions, couleurs, formats, durées et textes entre guillemets.'}</span><button onClick={() => setPane('brief')}>Revenir au brief <ArrowUpRight size={14}/></button></div>
            </>}
          </div>
        </aside>
        <main className="canvas-area">
          <div className="canvas-heading"><div><span className="overline">VOTRE STUDIO DE MOTION</span><h2>{project ? 'Une idée qui prend forme.' : 'Du produit à l’histoire.'}</h2></div><span className="preview-badge"><span className="dot"/>{project ? 'Aperçu en direct' : 'Film de démonstration'}</span></div>
          {error && <div className="message error" role="alert"><span>{error}</span><button aria-label="Fermer l’erreur" onClick={() => setError('')}><X size={16}/></button></div>}
          {notice && <div className="message notice" role="status"><Check size={16}/><span>{notice}</span><button aria-label="Fermer la notification" onClick={() => setNotice('')}><X size={16}/></button></div>}
          <section className={`preview-shell ${spec.format === '9:16' ? 'portrait' : spec.format === '1:1' ? 'square' : ''}`} aria-label="Aperçu de la vidéo"><div className="preview-topline"><span><Film size={14}/> {project ? spec.title : 'Orbit — Exemple de film produit'}</span><span>{spec.format} <i/> {spec.duration}s <i/> 30 fps</span></div><div className="player-stage">{ready ? <Player ref={player} component={MotionVideo} inputProps={{ spec }} durationInFrames={spec.duration * spec.fps} fps={spec.fps} compositionWidth={dimensions.width} compositionHeight={dimensions.height} controls loop initialFrame={24} showVolumeControls={false} style={{ width: '100%', aspectRatio: `${dimensions.width}/${dimensions.height}` }}/> : <div className="player-loading"><LoaderCircle className="spin"/> Ouverture du studio…</div>}</div><div className="preview-bottomline"><span><span className="live-dot"/> {styleLabels[spec.style]} <span className="muted">/ {dimensions.width} × {dimensions.height}</span></span><span>{(frame / 30).toFixed(1).padStart(4, '0')} <span className="muted">/ {spec.duration.toFixed(1)} sec</span></span></div></section>
          <section className="storyboard-section"><div className="storyboard-heading"><div><h3>Le storyboard <span>{spec.scenes.length} scènes</span></h3><p>{project ? 'Cliquez sur une scène pour affiner son contenu.' : 'Un récit simple. Trois moments qui comptent.'}</p></div><button className="text-button" disabled={!project || disabled} onClick={() => setShowJson(true)}><Code2 size={15}/>Voir la spec</button></div><div className="scene-grid" style={{ gridTemplateColumns: `repeat(${spec.scenes.length}, minmax(0, 1fr))` }}>{spec.scenes.map((scene, index) => <button key={scene.id} className={`scene-card ${project && selected === index ? 'active' : ''}`} onClick={() => selectScene(index)} disabled={!project || disabled}><div className={`scene-mini ${scene.type}`} style={{ '--scene-accent': spec.brand.accent } as React.CSSProperties}><span className="scene-number">{String(index + 1).padStart(2, '0')}</span>{scene.type === 'feature' ? <div className="mini-browser">{spec.assets.find(a => a.id === scene.assetId) ? <img src={spec.assets.find(a => a.id === scene.assetId)!.src} alt="Capture du produit"/> : <><div className="mini-browser-bar"/><div className="mini-columns"><i/><i/><i/></div></>}</div> : <div className="mini-title">{scene.type === 'cta' && scene.statistic ? scene.statistic : scene.title}<span>{scene.type === 'cta' ? scene.cta || 'Le bénéfice' : '● ● ●'}</span></div>}<span className="scene-time">{(scene.durationInFrames / 30).toFixed(1)}s</span></div><div className="scene-card-copy"><span>{familyLabels[scene.type]}</span><strong>{scene.title}</strong></div></button>)}</div></section>
          {job && <section className={`export-card ${job.status}`} aria-live="polite"><span className="export-icon">{job.status === 'done' ? <Check/> : job.status === 'error' ? <X/> : <LoaderCircle className="spin"/>}</span><div><strong>{job.phase}</strong><p>{job.status === 'error' ? job.error : `${job.width} × ${job.height} · ${job.duration}s · MP4 H.264`}{job.status === 'done' && (dirty || project?.id !== job.projectId || project?.revision !== job.revision) ? ' · Version précédente' : ''}</p>{rendering && <div className="progress-track"><div style={{ width: `${job.progress * 100}%` }}/></div>}</div>{job.status === 'done' ? <a className="button dark small" href={`/api/exports/${job.id}/download`}><ArrowDownToLine size={16}/>Télécharger</a> : <span className="export-percent">{Math.round(job.progress * 100)}%</span>}</section>}
          <footer className="canvas-footer"><span><Clapperboard size={14}/> Pensé pour les produits qui méritent d’être vus.</span><span>Storyboard → Preview → MP4 <ArrowUpRight size={13}/></span></footer>
        </main>
      </div>
    </div>
    {showJson && <div className="modal-backdrop" onClick={() => setShowJson(false)}><section className="json-modal" role="dialog" aria-modal="true" aria-label="Storyboard JSON" onClick={e => e.stopPropagation()}><div><h3>Storyboard JSON <span>v1</span></h3><button aria-label="Fermer" onClick={() => setShowJson(false)}><X size={20}/></button></div><p>Cette spec pilote l’aperçu et le rendu vidéo. Les retouches sont appliquées sous forme de patches validés.</p><pre>{JSON.stringify(spec, null, 2)}</pre><div className="modal-actions"><button className="button secondary" onClick={async () => { try { await navigator.clipboard.writeText(JSON.stringify(spec, null, 2)); setNotice('Spec copiée.'); } catch { setError('La copie est indisponible. Téléchargez le JSON.'); } }}><Copy size={16}/>Copier</button><button className="button dark" onClick={() => downloadJson(spec)}><ArrowDownToLine size={16}/>Télécharger le JSON</button></div></section></div>}
  </div>;
}
