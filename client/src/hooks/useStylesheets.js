import { useEffect } from 'react';

export function useStylesheets(stylesheets) {
  const key = stylesheets.join('|');

  useEffect(() => {
    const links = stylesheets.map(href => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.nationxRouteStyle = 'true';
      document.head.appendChild(link);
      return link;
    });

    return () => links.forEach(link => link.remove());
  }, [key]);
}
