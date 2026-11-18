export function highlightFieldError(fieldId, animate = false) {
  const field = document.getElementById(fieldId);
  const formGroup = field?.closest('.form-group');
  if (formGroup) {
    formGroup.classList.add('error');
    // Only animate if explicitly requested (from button clicks)
    if (animate) {
      formGroup.style.animation = 'none';
      void formGroup.offsetWidth; // Trigger reflow
      formGroup.style.animation = 'shake 0.5s ease-in-out';
    }
  }
}

// Makes `target`'s children match `source`'s while keeping the nodes that are
// already there. Assigning innerHTML swaps every element for a new one, and a
// CSS transition only runs on an element that is the same node before and
// after the change. Nodes are matched by position, so a level whose nodes
// differ in number or kind is replaced as a whole. Only attributes and text are
// compared: live form state, such as a typed value, is left as it is.
export function patchChildren(target, source) {
  const current = Array.from(target.childNodes);
  const next = Array.from(source.childNodes);
  const sameShape = current.length === next.length
    && current.every((node, i) => node.nodeName === next[i].nodeName);
  if (!sameShape) {
    target.replaceChildren(...next);
    return;
  }
  current.forEach((node, i) => {
    const incoming = next[i];
    if (node.nodeType !== Node.ELEMENT_NODE) {
      if (node.nodeValue !== incoming.nodeValue) node.nodeValue = incoming.nodeValue;
      return;
    }
    Array.from(node.attributes).forEach(({ name }) => {
      if (!incoming.hasAttribute(name)) node.removeAttribute(name);
    });
    Array.from(incoming.attributes).forEach(({ name, value }) => {
      if (node.getAttribute(name) !== value) node.setAttribute(name, value);
    });
    patchChildren(node, incoming);
  });
}
