import '@testing-library/jest-dom/vitest';
import i18n from '../i18n';

// Tests run in English
await i18n.changeLanguage('en');

// jsdom has no matchMedia (used by the theme)
if (!window.matchMedia) {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
}
