import { relative } from 'node:path';

export const designMetadataEnabled = (command, mode) => command === 'serve' && mode === 'design-lab';

// Compile-time hints, not React internals. Only our JSX host elements are tagged.
export default function designMetadata({ types: t }) {
  return {
    name: 'inscape-design-source',
    visitor: {
      JSXOpeningElement(path, state) {
        const file = relative(state.opts.root, state.filename).replaceAll('\\', '/');
        if (!/^(src|design-system)\//u.test(file)) return;
        const tag = path.node.name;
        if (!t.isJSXIdentifier(tag) || !/^[a-z]/u.test(tag.name)) return;
        let owner = 'unknown';
        for (let parent = path.parentPath; parent; parent = parent.parentPath) {
          const name = parent.isFunction() || parent.isClass() ? parent.node.id?.name
            || (parent.parentPath?.isVariableDeclarator() ? parent.parentPath.node.id.name : null) : null;
          if (name && /^[A-Z]/u.test(name)) { owner = name; break; }
        }
        const attributes = {
          'data-inscape-source': `${file}:${path.node.loc.start.line}`,
          'data-inscape-owner': owner,
          'data-inscape-kind': tag.name,
        };
        for (const [name, value] of Object.entries(attributes)) {
          if (!path.node.attributes.some(attribute => attribute.name?.name === name))
            path.node.attributes.push(t.jsxAttribute(t.jsxIdentifier(name), t.stringLiteral(value)));
        }
      },
    },
  };
}
