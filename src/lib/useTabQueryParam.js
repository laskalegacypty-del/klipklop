import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export function useTabQueryParam({
  activeTab,
  setActiveTab,
  allowedTabs,
  paramName = 'tab',
}) {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const urlTab = params.get(paramName)
    if (!urlTab) return

    if (allowedTabs.includes(urlTab)) {
      if (urlTab !== activeTab) setActiveTab(urlTab)
      return
    }

    params.delete(paramName)
    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : '',
      },
      { replace: true }
    )
  }, [allowedTabs, location.pathname, location.search, navigate, paramName, setActiveTab])

  useEffect(() => {
    if (!allowedTabs.includes(activeTab)) return

    const params = new URLSearchParams(location.search)
    const urlTab = params.get(paramName)
    if (urlTab === activeTab) return
    if (urlTab && allowedTabs.includes(urlTab) && urlTab !== activeTab) {
      // Let the read effect sync local state first; do not clobber URL on mount.
      return
    }

    params.set(paramName, activeTab)
    navigate(
      {
        pathname: location.pathname,
        search: `?${params.toString()}`,
      },
      { replace: true }
    )
  }, [activeTab, allowedTabs, location.pathname, location.search, navigate, paramName])
}
