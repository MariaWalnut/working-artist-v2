import { useEffect, useState } from 'react'

// True while the screen is phone-sized (or narrower than the given query).
export function useNarrow(query = '(max-width: 720px)') {
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return narrow
}
