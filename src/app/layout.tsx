import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Afacad, Adamina, Fira_Code } from "next/font/google";
import Script from "next/script";

import { Toaster } from "@/components/ui/sonner";
import { siteMetadata } from "@/data/metadata";
import { MetaPixelProvider } from "@/lib/meta-pixel";

import "./globals.css";

/**
 * Fonts come from the community theme. The previous pair was Geist Sans and
 * Geist Mono via the `geist` package, which is no longer referenced by
 * `globals.css`; `font-serif` is new and the theme uses it.
 *
 * `Adamina` publishes a single weight, so it has to be requested explicitly.
 * `Afacad` and `Fira_Code` are variable fonts and take the whole axis range.
 */
const fontSans = Afacad({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontSerif = Adamina({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
});

const fontMono = Fira_Code({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata = {
  ...siteMetadata,
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  return (
    <html lang="es-AR">
      <body
        className={`font-sans antialiased ${fontSans.variable} ${fontSerif.variable} ${fontMono.variable}`}
      >
        {pixelId ? (
          <Script
            id="meta-pixel-script"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${pixelId}');
                fbq('track', 'PageView');
              `,
            }}
          />
        ) : null}
        <MetaPixelProvider>{children}</MetaPixelProvider>
        <Toaster richColors />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
