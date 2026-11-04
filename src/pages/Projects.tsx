import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'
import { Desk } from '../components/desk/Desk'

export function Projects() {
  const dept = useActiveDept()
  return (
    <Shell>
      {dept?.id != null && <Desk deptId={dept.id} />}
    </Shell>
  )
}
