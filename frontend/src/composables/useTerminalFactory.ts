import { Terminal, type ITheme } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'
import type { Theme } from '@/stores/themeStore'

// 폰트 크기 상수
export const FONT_SIZE = {
  MIN: 10,
  MAX: 20,
  DEFAULT: 14
}

export interface TerminalInstance {
  terminal: Terminal
  fitAddon: FitAddon
  container: HTMLElement
  write: (data: string) => void
  writeln: (data: string) => void
  clear: () => void
  fit: () => void
  getDimensions: () => { cols: number; rows: number }
  onData: (callback: (data: string) => void) => void
  onResize: (callback: (size: { cols: number; rows: number }) => void) => void
  focus: () => void
  dispose: () => void
  setTheme: (theme: Theme) => void
  setFontSize: (size: number) => void
  setFontFamily: (fontFamily: string) => void
  adjustFontSize: (width: number, height: number) => void
}

// Catppuccin Mocha (Dark)
const DARK_THEME: ITheme = {
  background: '#1e1e2e',
  foreground: '#cdd6f4',
  cursor: '#f5e0dc',
  cursorAccent: '#1e1e2e',
  selectionBackground: '#585b70',
  selectionForeground: '#cdd6f4',
  black: '#45475a',
  red: '#f38ba8',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  blue: '#89b4fa',
  magenta: '#f5c2e7',
  cyan: '#94e2d5',
  white: '#bac2de',
  brightBlack: '#585b70',
  brightRed: '#f38ba8',
  brightGreen: '#a6e3a1',
  brightYellow: '#f9e2af',
  brightBlue: '#89b4fa',
  brightMagenta: '#f5c2e7',
  brightCyan: '#94e2d5',
  brightWhite: '#a6adc8'
}

// Catppuccin Latte (Light)
const LIGHT_THEME: ITheme = {
  background: '#eff1f5',
  foreground: '#4c4f69',
  cursor: '#dc8a78',
  cursorAccent: '#eff1f5',
  selectionBackground: '#acb0be',
  selectionForeground: '#4c4f69',
  black: '#5c5f77',
  red: '#d20f39',
  green: '#40a02b',
  yellow: '#df8e1d',
  blue: '#1e66f5',
  magenta: '#ea76cb',
  cyan: '#179299',
  white: '#acb0be',
  brightBlack: '#6c6f85',
  brightRed: '#d20f39',
  brightGreen: '#40a02b',
  brightYellow: '#df8e1d',
  brightBlue: '#1e66f5',
  brightMagenta: '#ea76cb',
  brightCyan: '#179299',
  brightWhite: '#bcc0cc'
}

export const TERMINAL_THEMES: Record<Theme, ITheme> = {
  dark: DARK_THEME,
  light: LIGHT_THEME
}

// CSS 변수에서 폰트 패밀리 읽기
function getFontFamilyFromCSS(): string {
  const computed = getComputedStyle(document.documentElement)
  return computed.getPropertyValue('--font-mono').trim() || '"Cascadia Code", Consolas, monospace'
}

function getTerminalOptions(theme: Theme, fontSize: number = FONT_SIZE.DEFAULT) {
  return {
    cursorBlink: true,
    cursorStyle: 'block' as const,
    fontFamily: getFontFamilyFromCSS(),
    fontSize,
    lineHeight: 1.2,
    theme: TERMINAL_THEMES[theme],
    allowProposedApi: true
  }
}

// 컨테이너 크기 기반으로 적절한 폰트 크기 계산
function calculateFontSize(width: number, height: number): number {
  // 기준: 400x300 이상이면 최대 크기, 그 이하면 비율에 따라 축소
  const baseWidth = 400
  const baseHeight = 300

  const widthRatio = Math.min(width / baseWidth, 1)
  const heightRatio = Math.min(height / baseHeight, 1)
  const ratio = Math.min(widthRatio, heightRatio)

  const calculatedSize = FONT_SIZE.MIN + (FONT_SIZE.MAX - FONT_SIZE.MIN) * ratio
  return Math.round(calculatedSize)
}

export function createTerminalInstance(container: HTMLElement, initialTheme: Theme = 'dark', initialFontSize: number = FONT_SIZE.DEFAULT): TerminalInstance {
  const terminal = new Terminal(getTerminalOptions(initialTheme, initialFontSize))
  const fitAddon = new FitAddon()
  const webLinks = new WebLinksAddon()

  terminal.loadAddon(fitAddon)
  terminal.loadAddon(webLinks)
  terminal.open(container)
  fitAddon.fit()

  return {
    terminal,
    fitAddon,
    container,
    write: (data: string) => terminal.write(data),
    writeln: (data: string) => terminal.writeln(data),
    clear: () => terminal.clear(),
    fit: () => fitAddon.fit(),
    getDimensions: () => ({ cols: terminal.cols, rows: terminal.rows }),
    onData: (callback) => { terminal.onData(callback) },
    onResize: (callback) => { terminal.onResize(callback) },
    focus: () => terminal.focus(),
    dispose: () => terminal.dispose(),
    setTheme: (theme: Theme) => {
      terminal.options.theme = TERMINAL_THEMES[theme]
    },
    setFontSize: (size: number) => {
      const clampedSize = Math.max(FONT_SIZE.MIN, Math.min(FONT_SIZE.MAX, size))
      terminal.options.fontSize = clampedSize
      fitAddon.fit()
    },
    setFontFamily: (fontFamily: string) => {
      terminal.options.fontFamily = fontFamily
      fitAddon.fit()
    },
    adjustFontSize: (width: number, height: number) => {
      const newSize = calculateFontSize(width, height)
      terminal.options.fontSize = newSize
      fitAddon.fit()
    }
  }
}
