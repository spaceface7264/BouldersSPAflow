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
