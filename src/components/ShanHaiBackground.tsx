import { motion, useReducedMotion } from 'motion/react'

export type ShanHaiState = 'today' | 'week' | 'tasks' | 'courses' | 'materials' | 'review' | 'settings'

type ShanHaiBackgroundProps = { state: ShanHaiState; emphasis?: 'none' | 'warm' }

const palette: Record<ShanHaiState, { wash: string; ridge: string; ridgeAlt: string; glow: string }> = {
  today: { wash: '#eaf4fb', ridge: '#9ec4d2', ridgeAlt: '#c1d7d9', glow: '#a5d7dc' },
  week: { wash: '#edf2f7', ridge: '#aab8c8', ridgeAlt: '#c4cbd8', glow: '#adc4d7' },
  tasks: { wash: '#edf4f7', ridge: '#a8c8cb', ridgeAlt: '#c1d8d8', glow: '#b5d7d0' },
  courses: { wash: '#f0f3f5', ridge: '#b5c5cc', ridgeAlt: '#d0d6d9', glow: '#c3d3d2' },
  materials: { wash: '#f3eff8', ridge: '#c3b6d3', ridgeAlt: '#d7cde2', glow: '#d8b9dc' },
  review: { wash: '#e9eef5', ridge: '#92a7bf', ridgeAlt: '#aebbd0', glow: '#8faecc' },
  settings: { wash: '#eff3f5', ridge: '#afc1c8', ridgeAlt: '#cad4d7', glow: '#b8cecb' },
}

export function ShanHaiBackground({ state, emphasis = 'none' }: ShanHaiBackgroundProps) {
  const reducedMotion = useReducedMotion()
  const colors = palette[state]
  const warm = emphasis === 'warm'

  return <div className={`shan-hai-background state-${state} ${warm ? 'emphasis-warm' : ''}`} aria-hidden="true" style={{ '--shan-wash': colors.wash, '--shan-ridge': colors.ridge, '--shan-ridge-alt': colors.ridgeAlt, '--shan-glow': colors.glow } as React.CSSProperties}>
    <div className="shan-hai-wash" />
    <motion.div className="shan-hai-cloud cloud-a" animate={reducedMotion ? undefined : { x: [0, 22, -12, 0], y: [0, -8, 7, 0], opacity: [0.25, 0.38, 0.28, 0.25] }} transition={{ duration: 34, repeat: Infinity, ease: 'easeInOut' }} />
    <motion.div className="shan-hai-cloud cloud-b" animate={reducedMotion ? undefined : { x: [0, -26, 12, 0], y: [0, 10, -5, 0], opacity: [0.18, 0.29, 0.2, 0.18] }} transition={{ duration: 42, repeat: Infinity, ease: 'easeInOut', delay: 2 }} />
    <svg className="shan-hai-ridges" viewBox="0 0 1600 720" preserveAspectRatio="none">
      <defs>
        <linearGradient id="shan-ridge-fill" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="var(--shan-ridge)" stopOpacity=".12" /><stop offset="1" stopColor="var(--shan-ridge)" stopOpacity=".02" /></linearGradient>
        <linearGradient id="shan-light-band" x1="0" x2="1"><stop offset="0" stopColor="var(--shan-glow)" stopOpacity="0" /><stop offset=".45" stopColor="var(--shan-glow)" stopOpacity=".38" /><stop offset="1" stopColor="var(--shan-glow)" stopOpacity="0" /></linearGradient>
        <filter id="shan-blur"><feGaussianBlur stdDeviation="22" /></filter>
      </defs>
      <motion.path className="ridge ridge-back" d="M-80 530 C180 360 290 445 490 370 S820 270 1010 385 S1320 490 1680 300 L1680 720 L-80 720 Z" fill="url(#shan-ridge-fill)" animate={reducedMotion ? undefined : { d: ['M-80 530 C180 360 290 445 490 370 S820 270 1010 385 S1320 490 1680 300 L1680 720 L-80 720 Z', 'M-80 500 C180 405 300 420 500 345 S820 315 1030 405 S1340 440 1680 330 L1680 720 L-80 720 Z', 'M-80 530 C180 360 290 445 490 370 S820 270 1010 385 S1320 490 1680 300 L1680 720 L-80 720 Z'] }} transition={{ duration: 38, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.path className="ridge ridge-mid" d="M-80 620 C190 490 340 535 550 455 S870 390 1050 500 S1370 545 1680 410" fill="none" stroke="var(--shan-ridge-alt)" strokeOpacity=".42" strokeWidth="2" animate={reducedMotion ? undefined : { x: [0, 18, -8, 0], y: [0, -5, 4, 0] }} transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }} />
      <motion.path className="ridge ridge-front" d="M-80 670 C170 565 370 625 590 535 S900 500 1110 585 S1400 625 1680 520" fill="none" stroke="var(--shan-ridge)" strokeOpacity=".27" strokeWidth="2.5" animate={reducedMotion ? undefined : { x: [0, -15, 9, 0], y: [0, 4, -3, 0] }} transition={{ duration: 27, repeat: Infinity, ease: 'easeInOut', delay: 1 }} />
      <motion.path className="light-band" d="M-250 410 C120 230 310 335 590 270 S1020 190 1240 310 S1510 345 1800 215" fill="none" stroke="url(#shan-light-band)" strokeWidth="64" filter="url(#shan-blur)" animate={reducedMotion ? undefined : { pathLength: [0.2, 1, 0.2], pathOffset: [0, 0.16, 0] }} transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }} />
    </svg>
    <div className="shan-hai-grain" />
  </div>
}
