const preventClipboardAction = (event) => event.preventDefault();

// Keep these on the input so they also apply when its password is revealed.
export const passwordClipboardHandlers = {
  onCopy: preventClipboardAction,
  onCut: preventClipboardAction,
  onPaste: preventClipboardAction,
  onDrop: preventClipboardAction,
  onDragStart: preventClipboardAction,
};
