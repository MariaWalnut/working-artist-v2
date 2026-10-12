import { db } from '../db/db'

// A portable backup of the whole local database. Because the app is local-first
// (data lives only in this browser), this is how data moves between browsers,
// ports or machines, and how you keep a safety copy.
// Images stored as base64 strings (coverImage, etc.) are included automatically
// since they are plain JSON values — no Blob conversion needed.

const FORMAT = 'working-artist-v2-backup'

type Dump = {
  format: string
  v: number
  dbVersion: number
  exportedAt: string
  tables: Record<string, Record<string, unknown>[]>
}

export async function exportData(): Promise<string> {
  const dump: Dump = {
    format: FORMAT,
    v: 1,
    dbVersion: db.verno,
    exportedAt: new Date().toISOString(),
    tables: {},
  }
  for (const t of db.tables) {
    dump.tables[t.name] = (await t.toArray()) as Record<string, unknown>[]
  }
  return JSON.stringify(dump)
}

export function summarise(json: string): { rows: number; exportedAt?: string } {
  const dump = JSON.parse(json) as Dump
  if (dump?.format !== FORMAT || !dump.tables) throw new Error('Not a Working Artist backup file.')
  let rows = 0
  for (const name in dump.tables) rows += dump.tables[name]?.length ?? 0
  return { rows, exportedAt: dump.exportedAt }
}

export async function importData(json: string): Promise<{ rows: number }> {
  const dump = JSON.parse(json) as Dump
  if (dump?.format !== FORMAT || !dump.tables) throw new Error('Not a Working Artist backup file.')
  let rows = 0
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) {
      await t.clear()
      const incoming = dump.tables[t.name]
      if (Array.isArray(incoming) && incoming.length) {
        await t.bulkAdd(incoming as Parameters<typeof t.bulkAdd>[0])
        rows += incoming.length
      }
    }
  })
  return { rows }
}

export async function downloadBackup(): Promise<void> {
  const json = await exportData()
  const stamp = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  a.download = `working-artist-backup-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(a.href)
    a.remove()
  }, 1000)
}
