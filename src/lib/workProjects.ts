import { db, type Work } from '../db/db'

const PROJECT_TYPE: Record<string, string> = { Book: 'Books', Release: 'Release', Film: 'Film' }

// A work in progress is also a project, so it has a box on the desk with its tasks and progress.
// Works without one get it here. Safe to run at any time; deleting the project keeps it from coming back.
export async function linkWorksInProgress(deptId: number) {
  await db.transaction('rw', db.works, db.projects, async () => {
    const works = await db.works.where('departmentId').equals(deptId).filter(w => !!w.inProgress && !w.noProject).toArray()
    for (const w of works) {
      if (w.projectId != null && await db.projects.get(w.projectId)) continue
      const projectId = await db.projects.add({
        departmentId: deptId, title: w.title, practice: w.practice, status: 'Active', workId: w.id,
        projectType: PROJECT_TYPE[w.kind ?? ''] ?? 'Other', location: w.location, publisher: w.publisher,
      }) as number
      await db.works.update(w.id!, { projectId } as Partial<Work>)
    }
  })
}
