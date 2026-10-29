import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Contact, type ContactList } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { useNarrow } from '../lib/useNarrow'
import { Shell } from '../components/layout/Shell'
import { Hint } from '../components/Hint'
import { allTags, byName, categoriesFor, copyEmails, deleteContact, downloadCSV, setOnList, websiteHref } from '../lib/contacts'
import { formatEventDate } from '../lib/eventDates'

type View = { kind: 'all' } | { kind: 'category'; name: string } | { kind: 'list'; id: number }

const inp: React.CSSProperties = { minHeight: 38, borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '9px 12px', fontSize: 13, color: '#111111', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }
const smallLabel: React.CSSProperties = { fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#767676', margin: '0 0 6px' }
const panel: React.CSSProperties = { background: '#FFFFFF', borderRadius: 20, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 2 }
const primary: React.CSSProperties = { background: 'var(--accent)', borderRadius: 8, border: 'none', padding: '8px 16px', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', cursor: 'pointer', color: '#111111' }
const quiet: React.CSSProperties = { background: 'none', border: '1px solid #EEEEEE', borderRadius: 8, padding: '6px 12px', fontSize: 11, color: '#444444', cursor: 'pointer', fontFamily: 'inherit' }

function Modal({ children, onClose, width = 520 }: { children: React.ReactNode; onClose: () => void; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: 20, padding: 24, width, maxWidth: '100%', maxHeight: '100%', overflowY: 'auto', boxSizing: 'border-box', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        {children}
      </div>
    </div>
  )
}

function Chip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ padding: '4px 11px', borderRadius: 999, border: on ? '1px solid transparent' : '1px solid #E8E8E8', background: on ? 'var(--accent)' : 'transparent', color: on ? '#111111' : '#555555', fontSize: 11, fontWeight: on ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
      {label}
    </button>
  )
}

function FilterItem({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', padding: '8px 10px', borderRadius: 8, border: 'none', background: active ? '#F5F5F5' : 'none', color: active ? '#111111' : '#555555', fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {count != null && <span style={{ fontSize: 10, color: '#6E6E6E', fontWeight: 400 }}>{count}</span>}
    </button>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 999, border: 'none', background: active ? '#111111' : '#FFFFFF', color: active ? '#FFFFFF' : '#444444', fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
      {label}
    </button>
  )
}

// ── Contact form ─────────────────────────────────────────────────────────────

function ContactForm({ contact, deptId, categories, lists, onDone }: {
  contact: Contact | null; deptId: number; categories: string[]; lists: ContactList[]; onDone: () => void
}) {
  const works = useLiveQuery(() => db.works.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []
  const events = useLiveQuery(() => db.eventEntries.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []
  const projects = useLiveQuery(() => db.projects.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []
  const [f, setF] = useState({
    name: contact?.name ?? '', organisation: contact?.organisation ?? '', role: contact?.role ?? '',
    category: contact?.category ?? '', email: contact?.email ?? '', phone: contact?.phone ?? '',
    website: contact?.website ?? '', address: contact?.address ?? '', note: contact?.note ?? '',
  })
  const [tags, setTags] = useState<string[]>(contact?.tags ?? [])
  const [tagText, setTagText] = useState('')
  const [newCategory, setNewCategory] = useState<string | null>(null)
  const [workIds, setWorkIds] = useState<number[]>(contact?.workIds ?? [])
  const [eventIds, setEventIds] = useState<number[]>(contact?.eventIds ?? [])
  const [projectIds, setProjectIds] = useState<number[]>(contact?.projectIds ?? [])
  const [onLists, setOnLists] = useState<number[]>(() => contact?.id == null ? [] : lists.filter(l => l.members.some(m => m.contactId === contact.id)).map(l => l.id!))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF(v => ({ ...v, [k]: e.target.value }))
  const toggle = (ids: number[], id: number) => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]

  function addTag() {
    const t = tagText.trim().replace(/,$/, '')
    if (t && !tags.includes(t)) setTags([...tags, t])
    setTagText('')
  }

  async function save() {
    if (!f.name.trim()) return
    const category = newCategory?.trim() || f.category || undefined
    if (newCategory?.trim()) {
      const dept = await db.departments.get(deptId)
      const own = dept?.contactCategories ?? []
      if (!categories.includes(category!)) await db.departments.update(deptId, { contactCategories: [...own, category!] })
    }
    const pending = tagText.trim() ? [...tags, tagText.trim()] : tags
    const clean = (v: string) => v.trim() || undefined
    const data = {
      departmentId: deptId, name: f.name.trim(), organisation: clean(f.organisation), role: clean(f.role), category,
      email: clean(f.email), phone: clean(f.phone), website: clean(f.website), address: clean(f.address), note: clean(f.note),
      tags: pending.length ? [...new Set(pending)] : undefined,
      workIds: workIds.length ? workIds : undefined, eventIds: eventIds.length ? eventIds : undefined, projectIds: projectIds.length ? projectIds : undefined,
    }
    let id = contact?.id
    if (id != null) await db.contacts.update(id, data)
    else id = await db.contacts.add({ ...data, createdAt: Date.now() }) as number
    for (const l of lists) await setOnList(l, id, onLists.includes(l.id!))
    onDone()
  }

  const groupLabel = (t: string) => <p style={{ ...smallLabel, margin: '14px 0 6px' }}>{t}</p>
  const chipRow: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 96, overflowY: 'auto' }

  return (
    <Modal onClose={onDone}>
      <p style={{ ...smallLabel, marginBottom: 14 }}>{contact ? 'Edit contact' : 'New contact'}</p>
      <input autoFocus value={f.name} onChange={set('name')} placeholder="Name" aria-label="Name" style={{ ...inp, fontSize: 16, fontFamily: 'Recoleta, serif', marginBottom: 8 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginBottom: 8 }}>
        <input value={f.organisation} onChange={set('organisation')} placeholder="Organisation" aria-label="Organisation" style={inp} />
        <input value={f.role} onChange={set('role')} placeholder="Role, e.g. Editor" aria-label="Role" style={inp} />
        {newCategory === null ? (
          <select value={f.category} aria-label="Category" onChange={e => e.target.value === '__new' ? setNewCategory('') : set('category')(e)} style={inp}>
            <option value="">No category</option>
            {categories.map(c => <option key={c}>{c}</option>)}
            <option value="__new">New category…</option>
          </select>
        ) : (
          <input autoFocus value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="New category" aria-label="New category" style={inp} />
        )}
        <input type="email" value={f.email} onChange={set('email')} placeholder="Email" aria-label="Email" style={inp} />
        <input type="tel" value={f.phone} onChange={set('phone')} placeholder="Phone" aria-label="Phone" style={inp} />
        <input value={f.website} onChange={set('website')} placeholder="Website" aria-label="Website" style={inp} />
      </div>
      <textarea value={f.address} onChange={set('address')} placeholder="Postal address" aria-label="Postal address" rows={3} style={{ ...inp, resize: 'vertical', marginBottom: 8 }} />
      <textarea value={f.note} onChange={set('note')} placeholder="Personal note, e.g. how you met" aria-label="Personal note" rows={2} style={{ ...inp, resize: 'vertical' }} />

      {groupLabel('Tags')}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {tags.map(t => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 6px 3px 10px', borderRadius: 999, background: '#F0F0F0', fontSize: 11 }}>
            {t}<button type="button" aria-label={`Remove tag ${t}`} onClick={() => setTags(tags.filter(x => x !== t))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666666', fontSize: 13, padding: '0 2px' }}>×</button>
          </span>
        ))}
        <input value={tagText} onChange={e => setTagText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }}
          onBlur={addTag} placeholder="Add a tag" aria-label="Add a tag" style={{ ...inp, width: 140, padding: '5px 10px', fontSize: 12 }} />
      </div>

      {lists.length > 0 && <>{groupLabel('On lists')}<div style={chipRow}>{lists.map(l => <Chip key={l.id} label={l.name} on={onLists.includes(l.id!)} onClick={() => setOnLists(toggle(onLists, l.id!))} />)}</div></>}
      {projects.length > 0 && <>{groupLabel('Projects together')}<div style={chipRow}>{projects.map(p => <Chip key={p.id} label={p.title} on={projectIds.includes(p.id!)} onClick={() => setProjectIds(toggle(projectIds, p.id!))} />)}</div></>}
      {works.length > 0 && <>{groupLabel('Works together')}<div style={chipRow}>{works.map(w => <Chip key={w.id} label={w.title} on={workIds.includes(w.id!)} onClick={() => setWorkIds(toggle(workIds, w.id!))} />)}</div></>}
      {events.length > 0 && <>{groupLabel('Events together')}<div style={chipRow}>{[...events].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).map(e => <Chip key={e.id} label={[e.title, formatEventDate(e.date, e.endDate)].filter(Boolean).join(' · ')} on={eventIds.includes(e.id!)} onClick={() => setEventIds(toggle(eventIds, e.id!))} />)}</div></>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 }}>
        <button onClick={() => void save()} style={primary}>{contact ? 'Save' : 'Add'}</button>
        <button onClick={onDone} style={{ background: 'none', border: 'none', fontSize: 12, color: '#666666', cursor: 'pointer' }}>Cancel</button>
        {contact?.id != null && (confirmDelete
          ? <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#666666' }}>Delete?</span>
              <button onClick={async () => { await deleteContact(contact.id!); onDone() }} style={{ background: '#C53030', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 10, fontWeight: 600, color: '#FFFFFF', cursor: 'pointer' }}>Delete</button>
            </span>
          : <button onClick={() => setConfirmDelete(true)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 12, color: '#767676', cursor: 'pointer' }}>Delete</button>)}
      </div>
    </Modal>
  )
}

// ── List form and people picker ──────────────────────────────────────────────

function ListForm({ list, deptId, onDone, onDeleted }: { list: ContactList | null; deptId: number; onDone: (id?: number) => void; onDeleted: () => void }) {
  const projects = useLiveQuery(() => db.projects.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []
  const [name, setName] = useState(list?.name ?? '')
  const [projectId, setProjectId] = useState(list?.projectId != null ? String(list.projectId) : '')
  async function save() {
    if (!name.trim()) return
    const data = { name: name.trim(), projectId: projectId ? Number(projectId) : undefined }
    if (list?.id != null) { await db.contactLists.update(list.id, data); onDone(list.id) }
    else onDone(await db.contactLists.add({ ...data, departmentId: deptId, members: [], createdAt: Date.now() }) as number)
  }
  return (
    <Modal onClose={() => onDone()} width={420}>
      <p style={{ ...smallLabel, marginBottom: 14 }}>{list ? 'Edit list' : 'New list'}</p>
      <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void save() }}
        placeholder="e.g. Christmas Card 2026" aria-label="List name" style={{ ...inp, marginBottom: 8 }} />
      <select value={projectId} onChange={e => setProjectId(e.target.value)} aria-label="Project" style={inp}>
        <option value="">Not for a project</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
      </select>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18 }}>
        <button onClick={() => void save()} style={primary}>{list ? 'Save' : 'Create'}</button>
        <button onClick={() => onDone()} style={{ background: 'none', border: 'none', fontSize: 12, color: '#666666', cursor: 'pointer' }}>Cancel</button>
        {list?.id != null && <button onClick={async () => { await db.contactLists.delete(list.id!); onDeleted() }} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 12, color: '#767676', cursor: 'pointer' }}>Delete list</button>}
      </div>
    </Modal>
  )
}

function PeoplePicker({ list, contacts, onDone }: { list: ContactList; contacts: Contact[]; onDone: () => void }) {
  const [q, setQ] = useState('')
  const [chosen, setChosen] = useState<number[]>(list.members.map(m => m.contactId))
  const shown = contacts.filter(c => !q || [c.name, c.organisation, c.category, ...(c.tags ?? [])].some(v => v?.toLowerCase().includes(q.toLowerCase())))
  async function save() {
    const kept = list.members.filter(m => chosen.includes(m.contactId))
    const added = chosen.filter(id => !kept.some(m => m.contactId === id)).map(contactId => ({ contactId }))
    await db.contactLists.update(list.id!, { members: [...kept, ...added] })
    onDone()
  }
  return (
    <Modal onClose={onDone} width={440}>
      <p style={{ ...smallLabel, marginBottom: 14 }}>People on {list.name}</p>
      <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, category or tag" aria-label="Search" style={{ ...inp, marginBottom: 10 }} />
      <div style={{ maxHeight: 340, overflowY: 'auto', borderTop: '1px solid #F5F5F5' }}>
        {shown.map(c => (
          <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 2px', borderBottom: '1px solid #F5F5F5', cursor: 'pointer' }}>
            <input type="checkbox" checked={chosen.includes(c.id!)} onChange={() => setChosen(ch => ch.includes(c.id!) ? ch.filter(x => x !== c.id) : [...ch, c.id!])} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, color: '#111111' }}>{c.name}</span>
              <span style={{ display: 'block', fontSize: 11, color: '#6E6E6E' }}>{[c.organisation, c.category].filter(Boolean).join(' · ')}</span>
            </span>
          </label>
        ))}
        {shown.length === 0 && <p style={{ fontSize: 12, color: '#767676', padding: '16px 0', textAlign: 'center' }}>No one matches</p>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
        <button onClick={() => void save()} style={primary}>Done</button>
        <span style={{ fontSize: 11, color: '#6E6E6E' }}>{chosen.length} chosen</span>
      </div>
    </Modal>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function Contacts() {
  const dept = useActiveDept()
  const deptId = dept?.id
  const narrow = useNarrow()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const contacts = (useLiveQuery(() => deptId == null ? [] : db.contacts.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []).sort(byName)
  const lists = (useLiveQuery(() => deptId == null ? [] : db.contactLists.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []).sort((a, b) => b.createdAt - a.createdAt)
  const projects = useLiveQuery(() => deptId == null ? [] : db.projects.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []

  const listParam = params.get('list')
  const [view, setView] = useState<View>(() => listParam ? { kind: 'list', id: Number(listParam) } : { kind: 'all' })
  const [tag, setTag] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Contact | 'new' | null>(null)
  const [listForm, setListForm] = useState<ContactList | 'new' | null>(null)
  const [picking, setPicking] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Links from elsewhere in the app open a contact (?c=) or a list (?list=).
  const cParam = params.get('c')
  useEffect(() => {
    if (!cParam) return
    const c = contacts.find(x => x.id === Number(cParam))
    if (c) { setEditing(c); setParams({}, { replace: true }) }
  }, [cParam, contacts.length])
  useEffect(() => { if (listParam) { setView({ kind: 'list', id: Number(listParam) }); setParams({}, { replace: true }) } }, [listParam])

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2400); return () => clearTimeout(t) }, [toast])

  if (deptId == null) return <Shell><div /></Shell>
  const categories = categoriesFor(dept, contacts)
  const used = categories.filter(c => contacts.some(x => x.category === c))
  const tags = allTags(contacts)
  const list = view.kind === 'list' ? lists.find(l => l.id === view.id) : undefined

  const matches = (c: Contact) =>
    (!tag || (c.tags ?? []).includes(tag)) &&
    (!q || [c.name, c.organisation, c.role, c.email, c.note, ...(c.tags ?? [])].some(v => v?.toLowerCase().includes(q.toLowerCase())))
  const people = list
    ? list.members.map(m => contacts.find(c => c.id === m.contactId)).filter((c): c is Contact => !!c).sort(byName).filter(matches)
    : contacts.filter(c => (view.kind !== 'category' || c.category === view.name) && matches(c))
  // A list that no longer exists shows everyone instead.
  const showingAll = view.kind === 'all' || (view.kind === 'list' && !list)
  const isDone = (c: Contact) => !!list?.members.find(m => m.contactId === c.id)?.done
  const doneCount = list ? list.members.filter(m => m.done && contacts.some(c => c.id === m.contactId)).length : 0
  const listProject = list?.projectId != null ? projects.find(p => p.id === list.projectId) : undefined

  async function toggleDone(c: Contact) {
    if (!list) return
    await db.contactLists.update(list.id!, { members: list.members.map(m => m.contactId === c.id ? { ...m, done: !m.done || undefined } : m) })
  }
  async function copy() {
    try {
      const n = await copyEmails(people)
      setToast(n === 0 ? 'No emails to copy' : `Copied ${n} email${n === 1 ? '' : 's'}`)
    } catch { setToast('Copying is blocked in this browser') }
  }

  const title = list ? list.name : view.kind === 'category' ? view.name : 'All contacts'

  const select = (v: View) => { setView(v); setTag(null) }

  return (
    <Shell>
      {editing !== null && <ContactForm contact={editing === 'new' ? null : editing} deptId={deptId} categories={categories} lists={lists} onDone={() => setEditing(null)} />}
      {listForm !== null && <ListForm list={listForm === 'new' ? null : listForm} deptId={deptId}
        onDone={id => { setListForm(null); if (id != null) select({ kind: 'list', id }) }} onDeleted={() => { setListForm(null); select({ kind: 'all' }) }} />}
      {picking && list && <PeoplePicker list={list} contacts={contacts} onDone={() => setPicking(false)} />}
      {toast && <p role="status" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 60, margin: 0, padding: '10px 18px', borderRadius: 999, background: '#111111', color: '#FFFFFF', fontSize: 12 }}>{toast}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : '230px 1fr', gap: 10, minHeight: narrow ? undefined : 600, alignItems: 'start' }}>
        {/* Left: people by category, then lists */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => setEditing('new')} style={{ background: 'var(--accent)', borderRadius: 999, padding: 11, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, border: 'none', cursor: 'pointer' }}>+ Add contact</button>
          {narrow ? <>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>
              <FilterChip label="All" active={showingAll} onClick={() => select({ kind: 'all' })} />
              {used.map(c => <FilterChip key={c} label={c} active={view.kind === 'category' && view.name === c} onClick={() => select({ kind: 'category', name: c })} />)}
            </div>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>
              {lists.map(l => <FilterChip key={l.id} label={l.name} active={list?.id === l.id} onClick={() => select({ kind: 'list', id: l.id! })} />)}
              <FilterChip label="+ New list" active={false} onClick={() => setListForm('new')} />
            </div>
          </> : <>
            <div style={panel}>
              <p style={{ ...smallLabel, padding: '0 8px 2px' }}>People</p>
              <FilterItem label="All contacts" count={contacts.length} active={showingAll} onClick={() => select({ kind: 'all' })} />
              {used.map(c => <FilterItem key={c} label={c} count={contacts.filter(x => x.category === c).length} active={view.kind === 'category' && view.name === c} onClick={() => select({ kind: 'category', name: c })} />)}
            </div>
            <div style={panel}>
              <p style={{ ...smallLabel, padding: '0 8px 2px' }}>Lists</p>
              {lists.map(l => <FilterItem key={l.id} label={l.name} count={l.members.length} active={list?.id === l.id} onClick={() => select({ kind: 'list', id: l.id! })} />)}
              <button onClick={() => setListForm('new')} style={{ textAlign: 'left', padding: '8px 10px', border: 'none', background: 'none', fontSize: 12, color: '#555555', cursor: 'pointer', fontFamily: 'inherit' }}>+ New list</button>
            </div>
          </>}
        </div>

        {/* Right */}
        <div style={{ background: '#FFFFFF', borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ padding: narrow ? '18px 16px 12px' : '22px 24px 14px', borderBottom: '1px solid #F5F5F5' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontFamily: 'Recoleta, serif', fontWeight: 400, fontSize: 24, color: '#111111' }}>{title}</h1>
              {list
                ? <span style={{ fontSize: 12, color: '#6E6E6E' }}>{doneCount} of {list.members.length} ticked off</span>
                : <span style={{ fontSize: 12, color: '#6E6E6E' }}>{people.length}</span>}
              {listProject && (
                <button onClick={() => navigate(`/projects/${listProject.id}`)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: '#111111', cursor: 'pointer', borderBottom: '2px solid var(--accent)', fontFamily: 'inherit' }}>
                  {listProject.title}
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" aria-label="Search contacts" style={{ ...inp, width: narrow ? '100%' : 200, padding: '6px 12px', fontSize: 12 }} />
              {list && <>
                <button onClick={() => setPicking(true)} style={quiet}>+ Add people</button>
                <button onClick={() => setListForm(list)} style={quiet}>Edit list</button>
              </>}
              <span style={{ flex: 1 }} />
              <button onClick={() => void copy()} style={quiet}>Copy emails</button>
              <button onClick={() => downloadCSV(title, people, list ? isDone : undefined)} style={quiet}>Download</button>
            </div>
            {tags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {tags.map(t => <Chip key={t} label={t} on={tag === t} onClick={() => setTag(tag === t ? null : t)} />)}
              </div>
            )}
          </div>

          {contacts.length === 0 ? (
            <div style={{ padding: '40px 24px' }}>
              <p style={{ textAlign: 'center', margin: '0 0 16px', fontSize: 11, color: '#767676', letterSpacing: '0.1em', textTransform: 'uppercase' }}>No contacts yet</p>
              <Hint id="contacts-start" style={{ maxWidth: 440, margin: '0 auto' }}>Add the people you work with: galleries, editors, curators, collectors. Then gather them into lists, like everyone who gets a card at Christmas.</Hint>
            </div>
          ) : people.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '48px 24px', margin: 0, fontSize: 11, color: '#767676', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {list && list.members.length === 0 ? 'No one on this list yet' : 'Nothing matches'}
            </p>
          ) : people.map(c => {
            const done = isDone(c)
            return (
              <div key={c.id} onClick={() => setEditing(c)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: narrow ? '13px 16px' : '14px 24px', borderBottom: '1px solid #F5F5F5', cursor: 'pointer' }}>
                {list && (
                  <input type="checkbox" checked={done} aria-label={`Tick off ${c.name}`} onClick={e => e.stopPropagation()} onChange={() => void toggleDone(c)}
                    style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0, accentColor: '#111111' }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: done ? '#6E6E6E' : '#111111', textDecoration: done ? 'line-through' : undefined }}>{c.name}</span>
                    {c.category && !list && <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#555555', background: '#F5F5F5', padding: '2px 7px', borderRadius: 999 }}>{c.category}</span>}
                  </div>
                  {(c.organisation || c.role) && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6E6E6E' }}>{[c.role, c.organisation].filter(Boolean).join(', ')}</p>}
                  {narrow && (c.email || c.phone) && (
                    <p style={{ margin: '3px 0 0', fontSize: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                      {c.email && <a href={`mailto:${c.email}`} style={{ color: '#111111', textDecoration: 'none' }}>{c.email}</a>}
                      {c.phone && <a href={`tel:${c.phone.replace(/\s+/g, '')}`} style={{ color: '#6E6E6E', textDecoration: 'none' }}>{c.phone}</a>}
                    </p>
                  )}
                  {list && c.address && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#444444', whiteSpace: 'pre-line' }}>{c.address}</p>}
                  {(c.tags?.length ?? 0) > 0 && !list && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                      {c.tags!.map(t => <span key={t} style={{ fontSize: 10, color: '#555555', background: '#F5F5F5', padding: '1px 7px', borderRadius: 999 }}>{t}</span>)}
                    </div>
                  )}
                </div>
                <div style={{ display: narrow ? 'none' : 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0, maxWidth: 260 }} onClick={e => e.stopPropagation()}>
                  {c.email && <a href={`mailto:${c.email}`} style={{ fontSize: 12, color: '#111111', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{c.email}</a>}
                  {c.phone && <a href={`tel:${c.phone.replace(/\s+/g, '')}`} style={{ fontSize: 12, color: '#6E6E6E', textDecoration: 'none' }}>{c.phone}</a>}
                  {c.website && <a href={websiteHref(c.website)} target="_blank" rel="noopener" style={{ fontSize: 12, color: '#6E6E6E', textDecoration: 'none' }}>{c.website.replace(/^https?:\/\//, '')}</a>}
                </div>
                {list && (
                  <button aria-label={`Take ${c.name} off this list`} onClick={e => { e.stopPropagation(); void setOnList(list, c.id!, false) }}
                    style={{ background: 'none', border: 'none', fontSize: 14, color: '#767676', cursor: 'pointer', flexShrink: 0, padding: '0 2px' }}>×</button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Shell>
  )
}
