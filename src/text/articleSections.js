// Page breaks divide authored sections, independently of viewport size.
// Split nested blocks without flattening their formatting or artwork nodes.
function splitNodes(nodes) {
  const sections = [[]];
  for (const node of nodes) {
    if (node.type === 'pageBreak') { sections.push([]); continue; }
    const parts = node.content ? splitNodes(node.content) : null;
    if (!parts || parts.length === 1) { sections.at(-1).push(node); continue; }
    parts.forEach((content, index) => {
      if (index) sections.push([]);
      if (content.length) sections.at(-1).push({ ...node, content: node.type === 'listItem' && content[0].type !== 'paragraph'
        ? [{ type: 'paragraph' }, ...content] : content });
    });
  }
  return sections;
}
export const articleSections = article => splitNodes(article.content.content || []);
export const joinArticleSections = sections => ({ type: 'doc', content: sections.flatMap((nodes, index) => [
  ...(index ? [{ type: 'pageBreak' }] : []), ...(nodes?.length ? nodes : [{ type: 'paragraph' }]),
]) });
export function sectionArticle(article, index) {
  const nodes = index < 0 ? [] : articleSections(article)[index];
  return { ...article, title: index === 0 ? article.title : '', content: joinArticleSections([nodes || []]) };
}
