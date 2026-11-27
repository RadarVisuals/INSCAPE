export function clearOwnerSystemWorkflowDocumentSelection() {
  const selection = globalThis.getSelection?.();
  if (selection?.rangeCount) selection.removeAllRanges();
}

const POINTER_FOCUS_ATTRIBUTE = 'data-system-workflow-pointer-focus';

export function markOwnerSystemWorkflowPointerFocus(node) {
  if (!node) return;
  node.setAttribute(POINTER_FOCUS_ATTRIBUTE, '');
  const clear = () => {
    node.removeAttribute(POINTER_FOCUS_ATTRIBUTE);
    node.removeEventListener('blur', clear);
    globalThis.removeEventListener?.('keydown', clear, true);
  };
  node.addEventListener('blur', clear, { once: true });
  globalThis.addEventListener?.('keydown', clear, { capture: true, once: true });
}
