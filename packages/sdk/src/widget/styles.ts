export const WIDGET_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600;1,700&display=swap');

:root {
  --a360-font-serif: "Cormorant Garamond", Garamond, Georgia, "Times New Roman", serif;
  --a360-font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --a360-primary: #059669;
  --a360-primary-hover: #047857;
  --a360-primary-light: #ecfdf5;
  --a360-text: #1f2937;
  --a360-text-muted: #6b7280;
  --a360-bg: #ffffff;
  --a360-border: #e5e7eb;
  --a360-radius: 14px;
  --a360-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.a360-launcher-btn {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 999990;
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: var(--a360-primary);
  color: #ffffff;
  border: none;
  border-radius: 9999px;
  padding: 13px 24px;
  font-family: var(--a360-font-serif);
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  box-shadow: 0 10px 20px -3px rgba(5, 150, 105, 0.4);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.a360-launcher-btn:hover {
  transform: translateY(-2px);
  background-color: var(--a360-primary-hover);
  box-shadow: 0 14px 24px -3px rgba(5, 150, 105, 0.5);
}

.a360-launcher-btn.bottom-left {
  right: auto;
  left: 24px;
}

.a360-launcher-btn svg {
  width: 20px;
  height: 20px;
}

/* Modal Overlay */
.a360-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(17, 24, 39, 0.6);
  backdrop-filter: blur(4px);
  z-index: 999995;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.25s ease, visibility 0.25s ease;
}

.a360-overlay.a360-open {
  opacity: 1;
  visibility: visible;
}

/* Modal Container */
.a360-modal {
  background: var(--a360-bg);
  color: var(--a360-text);
  border-radius: var(--a360-radius);
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--a360-shadow);
  display: flex;
  flex-direction: column;
  position: relative;
  font-family: var(--a360-font-sans);
  transform: scale(0.95);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.a360-overlay.a360-open .a360-modal {
  transform: scale(1);
}

/* Header */
.a360-header {
  padding: 18px 24px;
  border-bottom: 1px solid var(--a360-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.a360-header-title {
  margin: 0;
  font-family: var(--a360-font-serif);
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--a360-text);
  display: flex;
  align-items: center;
  gap: 10px;
}

.a360-header-close {
  background: none;
  border: none;
  color: var(--a360-text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s ease;
}

.a360-header-close:hover {
  background-color: var(--a360-border);
  color: var(--a360-text);
}

/* Steps progress bar */
.a360-steps {
  display: flex;
  padding: 12px 24px;
  background-color: #f9fafb;
  border-bottom: 1px solid var(--a360-border);
  gap: 8px;
}

.a360-step-indicator {
  flex: 1;
  height: 4px;
  background-color: var(--a360-border);
  border-radius: 2px;
  transition: background-color 0.2s ease;
}

.a360-step-indicator.active {
  background-color: var(--a360-primary);
}

/* Content */
.a360-body {
  padding: 24px;
  flex: 1;
}

.a360-step-title {
  margin: 0 0 16px 0;
  font-family: var(--a360-font-serif);
  font-size: 21px;
  font-weight: 700;
  color: var(--a360-text);
}

/* Item cards (Services, Professionals) */
.a360-card-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.a360-card-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border: 1.5px solid var(--a360-border);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, transform 0.1s ease;
  user-select: none;
}

.a360-card-item:hover {
  border-color: var(--a360-primary);
  background-color: var(--a360-primary-light);
  transform: translateY(-1px);
}

.a360-card-item.selected {
  border-color: var(--a360-primary);
  background-color: var(--a360-primary-light);
}

.a360-card-info h4 {
  margin: 0 0 3px 0;
  font-family: var(--a360-font-serif);
  font-size: 19px;
  font-weight: 700;
  line-height: 1.2;
}

.a360-card-info p {
  margin: 0;
  font-size: 13px;
  color: var(--a360-text-muted);
}

.a360-card-price {
  font-family: var(--a360-font-serif);
  font-size: 19px;
  font-weight: 700;
  color: var(--a360-primary);
}

/* Days picker (horizontal chips) */
.a360-days-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 12px;
  margin-bottom: 18px;
}

.a360-day-chip {
  flex: 0 0 auto;
  padding: 10px 14px;
  border: 1px solid var(--a360-border);
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.a360-day-chip:hover {
  border-color: var(--a360-primary);
}

.a360-day-chip.selected {
  background-color: var(--a360-primary);
  border-color: var(--a360-primary);
  color: #ffffff;
}

.a360-day-chip .day-name {
  font-size: 11px;
  text-transform: uppercase;
  font-weight: 600;
  display: block;
}

.a360-day-chip .day-number {
  font-family: var(--a360-font-serif);
  font-size: 18px;
  font-weight: 700;
}

/* Time Slots Grid */
.a360-slots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
}

.a360-slot-btn {
  padding: 10px 8px;
  border: 1px solid var(--a360-border);
  border-radius: 8px;
  background: none;
  font-size: 14px;
  font-weight: 600;
  color: var(--a360-text);
  cursor: pointer;
  text-align: center;
  transition: all 0.15s ease;
}

.a360-slot-btn:hover {
  border-color: var(--a360-primary);
  background-color: var(--a360-primary-light);
}

.a360-slot-btn.selected {
  background-color: var(--a360-primary);
  border-color: var(--a360-primary);
  color: #ffffff;
}

/* Forms */
.a360-form-group {
  margin-bottom: 16px;
}

.a360-form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--a360-text);
}

.a360-input, .a360-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 14px;
  border: 1px solid var(--a360-border);
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  color: var(--a360-text);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.a360-input:focus, .a360-textarea:focus {
  border-color: var(--a360-primary);
  box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.15);
}

/* Footer & Buttons */
.a360-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--a360-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #fafafa;
}

.a360-btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
}

.a360-btn-secondary {
  background-color: transparent;
  color: var(--a360-text-muted);
}

.a360-btn-secondary:hover {
  color: var(--a360-text);
  background-color: var(--a360-border);
}

.a360-btn-primary {
  background-color: var(--a360-primary);
  color: #ffffff;
  font-family: var(--a360-font-serif);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.a360-btn-primary:hover:not(:disabled) {
  background-color: var(--a360-primary-hover);
}

.a360-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Success Card */
.a360-success-box {
  text-align: center;
  padding: 16px 0;
}

.a360-success-box h3 {
  font-family: var(--a360-font-serif);
  font-size: 26px;
  font-weight: 700;
}

.a360-success-icon {
  width: 56px;
  height: 56px;
  background-color: #d1fae5;
  color: #059669;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px auto;
}

.a360-success-icon svg {
  width: 32px;
  height: 32px;
}

.a360-summary-card {
  background-color: #f9fafb;
  border: 1px solid var(--a360-border);
  border-radius: 10px;
  padding: 16px;
  text-align: left;
  margin: 18px 0;
  font-size: 14px;
  line-height: 1.6;
}

.a360-loading-spinner {
  display: inline-block;
  width: 24px;
  height: 24px;
  border: 3px solid rgba(5, 150, 105, 0.2);
  border-radius: 50%;
  border-top-color: var(--a360-primary);
  animation: a360-spin 0.8s linear infinite;
  margin: 20px auto;
}

@keyframes a360-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 640px) {
  .a360-modal {
    max-height: 96vh;
    border-radius: 16px 16px 0 0;
    margin-top: auto;
  }
  .a360-overlay {
    padding: 0;
    align-items: flex-end;
  }
}
`;
