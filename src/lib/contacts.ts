import { db, type Contact, type ContactList, type Department } from '../db/db'

export const PRESET_CATEGORIES = ['Gallery', 'Publisher', 'Curator', 'Collector', 'Press', 'Client', 'Institution', 'Artist', 'Other']

// Presets first, then the studio's own categories and any still used by a contact.
export function categoriesFor(dept: Department | undefined, contacts: Contact[]) {
  const own = [...(dept?.contactCategories ?? []), ...contacts.map(c => c.category ?? '')]
  return [...new Set([...PRESET_CATEGORIES, ...own.filter(Boolean)])]
}

export const allTags = (contacts: Contact[]) =>
  [...new Set(contacts.flatMap(c => c.tags ?? []))].sort((a, b) => a.localeCompare(b))

export const byName = (a: Contact, b: Contact) => a.name.localeCompare(b.name)

// Deleting someone also takes them off every list.
export async function deleteContact(id: number) {
  await db.transaction('rw', db.contacts, db.contactLists, async () => {
    await db.contacts.delete(id)
    await db.contactLists.toCollection().modify(l => { l.members = l.members.filter(m => m.contactId !== id) })
  })
}

export async function setOnList(list: ContactList, contactId: number, on: boolean) {
  const has = list.members.some(m => m.contactId === contactId)
  if (on === has) return
  const members = on ? [...list.members, { contactId }] : list.members.filter(m => m.contactId !== contactId)
  await db.contactLists.update(list.id!, { members })
}

const cell = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v

// A spreadsheet of the given people, with an extra column when it comes from a list.
export function downloadCSV(name: string, people: Contact[], done?: (c: Contact) => boolean) {
  const head = ['Name', 'Organisation', 'Role', 'Category', 'Email', 'Phone', 'Website', 'Address', 'Tags', 'Note', ...(done ? ['Done'] : [])]
  const rows = people.map(c => [
    c.name, c.organisation ?? '', c.role ?? '', c.category ?? '', c.email ?? '', c.phone ?? '', c.website ?? '',
    c.address ?? '', (c.tags ?? []).join(', '), c.note ?? '', ...(done ? [done(c) ? 'Yes' : ''] : []),
  ])
  const csv = [head, ...rows].map(r => r.map(cell).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  a.download = `${name.replace(/[^\w\- ]+/g, '').trim() || 'Contacts'}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export async function copyEmails(people: Contact[]) {
  const emails = people.map(c => c.email?.trim()).filter((e): e is string => !!e)
  if (emails.length === 0) return 0
  await navigator.clipboard.writeText(emails.join(', '))
  return emails.length
}

export const websiteHref = (w: string) => /^https?:\/\//i.test(w) ? w : `https://${w}`
