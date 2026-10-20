// Escáner de códigos de barras con la cámara (y opción de escribir el código).
import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'

interface Props {
  onCode: (code: string) => void
  onClose: () => void
}

export function BarcodeScanner({ onCode, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [manual, setManual] = useState('')
  const [cameraError, setCameraError] = useState('')

  useEffect(() => {
    let controls: IScannerControls | undefined
    let done = false
    const reader = new BrowserMultiFormatReader()
    reader
      .decodeFromConstraints({ video: { facingMode: 'environment' } }, videoRef.current!, (result) => {
        if (result && !done) {
          done = true
          controls?.stop()
          onCode(result.getText())
        }
      })
      .then((c) => {
        controls = c
        if (done) c.stop()
      })
      .catch(() => setCameraError('No se pudo abrir la cámara. Puedes escribir el código abajo.'))
    // Al cerrar la pantalla apagamos la cámara.
    return () => controls?.stop()
  }, [onCode])

  return (
    <div className="sheet">
      <header className="sheet-header">
        <button className="link" onClick={onClose}>Cerrar</button>
        <h2>Escanear</h2>
        <span />
      </header>
      {cameraError ? <p className="error">{cameraError}</p> : (
        <>
          <video ref={videoRef} className="scanner" muted playsInline />
          <p className="hint">Apunta al código de barras del empaque.</p>
        </>
      )}
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (manual.trim()) onCode(manual.trim()) }}>
        <input inputMode="numeric" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="O escribe el código" />
        <button type="submit">Buscar</button>
      </form>
    </div>
  )
}
