/**
 * Rewrites internal-link tokens used by the content factory:
 *   BRAND/calculator|tool|quiz -> /#tool
 *   BRAND/guide|guides         -> /guides/
 *   BRAND/<slug>               -> /<slug>/
 * (Pilot lesson: without the calculator/guide aliases every article soft-404s.)
 * No external deps — tiny tree walk.
 */
function walk(node, fn) {
  fn(node);
  if (node.children) for (const c of node.children) walk(c, fn);
}

export function brandLinks() {
  return (tree) => {
    walk(tree, (node) => {
      if (node.type !== 'link') return;
      const m = (node.url || '').match(/^(?:https?:\/\/)?BRAND\/(.+?)\/?$/);
      if (!m) return;
      const t = m[1];
      if (t === 'calculator' || t === 'tool' || t === 'quiz') node.url = '/#tool';
      else if (t === 'guide' || t === 'guides') node.url = '/guides/';
      else node.url = `/${t}/`;
    });
  };
}
