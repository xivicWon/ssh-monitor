import { ref, onUnmounted, type Ref } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from 'xterm-addon-web-links'
import 'xterm/css/xterm.css'

export function useTerminal() {
  const terminal = ref<Terminal | null>(null)
  const fitAddon = ref<FitAddon | null>(null)
  const containerRef = ref<HTMLElement | null>(null)

  function initTerminal(container: HTMLElement): Terminal {
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: '"Cascadia Code", "Fira Code", Consolas, Monaco, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      theme: {
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
      },
      allowProposedApi: true
    })

    const fit = new FitAddon()
    const webLinks = new WebLinksAddon()

    term.loadAddon(fit)
    term.loadAddon(webLinks)

    term.open(container)
    fit.fit()

    terminal.value = term
    fitAddon.value = fit
    containerRef.value = container

    return term
  }

  function write(data: string) {
    terminal.value?.write(data)
  }

  function writeln(data: string) {
    terminal.value?.writeln(data)
  }

  function clear() {
    terminal.value?.clear()
  }

  function fit() {
    fitAddon.value?.fit()
  }

  function getDimensions(): { cols: number; rows: number } {
    return {
      cols: terminal.value?.cols || 80,
      rows: terminal.value?.rows || 24
    }
  }

  function onData(callback: (data: string) => void) {
    terminal.value?.onData(callback)
  }

  function onResize(callback: (size: { cols: number; rows: number }) => void) {
    terminal.value?.onResize(callback)
  }

  function focus() {
    terminal.value?.focus()
  }

  function dispose() {
    terminal.value?.dispose()
    terminal.value = null
    fitAddon.value = null
  }

  onUnmounted(() => {
    dispose()
  })

  return {
    terminal,
    containerRef,
    initTerminal,
    write,
    writeln,
    clear,
    fit,
    getDimensions,
    onData,
    onResize,
    focus,
    dispose
  }
}
