import './globals.css'

// Use local system fallbacks so preview builds do not depend on next/font/google network resolution.
const fontVariables = {
  '--font-heading': "'DM Sans', ui-sans-serif, system-ui, sans-serif",
  '--font-body': "Inter, ui-sans-serif, system-ui, sans-serif",
} as React.CSSProperties

export const metadata = {
  title: 'Digimax Sales v2.0',
  description: 'Gestion de ventas y metricas',
  icons: { icon: '/logo.webp' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body style={fontVariables} className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
