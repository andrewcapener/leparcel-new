import Script from 'next/script'
import { pixelId } from '@/server/modules/meta/config'

/**
 * The browser half of the pixel.
 *
 * Renders NOTHING until NEXT_PUBLIC_META_PIXEL_ID is set, which is what keeps
 * the privacy page honest: with no id configured there is genuinely no
 * advertising pixel on this site, and the page can go on saying so.
 *
 * It fires PageView only. The conversion that matters, an application, is
 * sent from the server through the Conversions API instead, because a browser
 * event is lost to an ad blocker, to Safari, and to anybody who closes the tab
 * before the script runs. See src/server/modules/meta/capi.ts.
 *
 * Limited Data Use is set before init, not after: Mermade is a California
 * business, CPRA applies, and the flag has to be on the first event or the
 * first one is not covered.
 *
 * afterInteractive, so it never delays the page. Marketing does not get to be
 * the reason the hero is slow.
 */
export function MetaPixel() {
  const id = pixelId()
  if (!id) return null

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('dataProcessingOptions', ['LDU'], 1, 1000);
fbq('init', ${JSON.stringify(id)});
fbq('track', 'PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img height="1" width="1" style={{ display: 'none' }} alt=""
          src={`https://www.facebook.com/tr?id=${encodeURIComponent(id)}&ev=PageView&noscript=1`} />
      </noscript>
    </>
  )
}
