import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * The page around the app on the web, which is how Fuel runs on an iPhone.
 * Used only for the web build (it runs in Node at build time, not in the browser).
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover lets the app pad for the notch and home bar itself; maximum-scale stops iOS zooming into a field you tap (pinch zoom still works). */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <meta name="description" content="Calorie and macro tracker" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#07080C" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#F3F4F8" />
        {/* Added to the Home Screen, it opens full screen like an app. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Fuel" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: BACKGROUND }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// No white flash before the app draws: the page starts in the app's own background.
const BACKGROUND = `body{background-color:#F3F4F8}@media (prefers-color-scheme: dark){body{background-color:#07080C}}`;
