import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import ArticleView from '../text/ArticleView.jsx';

// Use the reader's actual fonts, inline marks, paragraphs and padding. The
// measuring surface is outside the zoomed workspace and never takes focus.
export function createReceptionTextMeasure() {
  let host, root;
  return {
    measureText(article, cell) {
      if (!host) {
        host = document.createElement('div');
        host.className = 'reception-text-measure';
        host.setAttribute('aria-hidden', 'true');
        host.inert = true;
        root = createRoot(host);
      }
      const rotated = article.appearance?.transform?.quarterTurns % 2 === 1;
      host.style.maxWidth = `${rotated ? cell.height : cell.width}px`;
      host.style.setProperty('--text-stack-height', `${(rotated ? cell.width : cell.height) / (article.appearance?.scale || 1)}px`);
      document.body.append(host);
      try {
        flushSync(() => root.render(<ArticleView article={article} />));
        const { width, height } = host.getBoundingClientRect();
        return rotated ? { width: height, height: width } : { width, height };
      } finally {
        host.remove();
      }
    },
    disposeTextMeasure() {
      // The editor can release its scope during React's own unmount.
      if (root) queueMicrotask(() => root.unmount());
    },
  };
}
