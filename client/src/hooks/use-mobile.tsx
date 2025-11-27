import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile(): boolean | undefined {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(() => {
    if (typeof window === "undefined") return undefined
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches
  })

  React.useLayoutEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    
    const checkMobile = () => {
      setIsMobile(mql.matches)
    }
    
    checkMobile()
    
    mql.addEventListener("change", checkMobile)
    window.addEventListener("resize", checkMobile)
    
    return () => {
      mql.removeEventListener("change", checkMobile)
      window.removeEventListener("resize", checkMobile)
    }
  }, [])

  return isMobile
}
