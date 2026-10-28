import React from 'react';
import { Languages } from 'lucide-react';

const TRANSLATOR_ELEMENT_ID = 'google_translate_element';
const TRANSLATOR_SCRIPT_ID = 'google-translate-script';

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      accounts?: {
        id?: {
          initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: {
            theme?: 'outline' | 'filled_blue' | 'filled_black';
            size?: 'large' | 'medium' | 'small';
            text?: string;
            shape?: string;
            width?: number;
            locale?: string;
          }) => void;
        };
      };
      translate?: {
        TranslateElement: new (options: {
          pageLanguage: string;
          includedLanguages: string;
          autoDisplay: boolean;
          layout?: number;
        }, elementId: string) => unknown;
      };
    };
  }
}

export default function BrowserLanguageTranslator() {
  const initializeTranslator = React.useCallback(() => {
    if (!window.google?.translate?.TranslateElement) return false;
    const container = document.getElementById(TRANSLATOR_ELEMENT_ID);
    if (!container) return false;
    if (container.childElementCount > 0) return true;

    new window.google.translate.TranslateElement(
      {
        pageLanguage: 'en',
        includedLanguages: 'en,tl',
        autoDisplay: false,
      },
      TRANSLATOR_ELEMENT_ID,
    );
    return true;
  }, []);

  React.useEffect(() => {
    window.googleTranslateElementInit = initializeTranslator;
    let retryTimer: number | undefined;

    const waitForTranslator = () => {
      if (initializeTranslator()) return;

      retryTimer = window.setInterval(() => {
        if (initializeTranslator() && retryTimer !== undefined) {
          window.clearInterval(retryTimer);
          retryTimer = undefined;
        }
      }, 100);
    };

    if (document.getElementById(TRANSLATOR_SCRIPT_ID)) {
      waitForTranslator();
      return () => {
        if (retryTimer !== undefined) window.clearInterval(retryTimer);
        delete window.googleTranslateElementInit;
      };
    }

    const script = document.createElement('script');
    script.id = TRANSLATOR_SCRIPT_ID;
    script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    script.async = true;
    script.addEventListener('load', waitForTranslator, { once: true });
    document.body.appendChild(script);

    return () => {
      if (retryTimer !== undefined) window.clearInterval(retryTimer);
      delete window.googleTranslateElementInit;
    };
  }, [initializeTranslator]);

  return (
    <div className="notranslate fixed right-4 top-30 z-[100] flex items-center gap-2 rounded-full border border-border/70 bg-card/95 px-3 py-1.5 shadow-lg backdrop-blur-md" translate="no">
      <Languages size={16} className="text-primary" aria-hidden="true" />
      <span className="hidden text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:inline">Language</span>
      <div id={TRANSLATOR_ELEMENT_ID} aria-label="Choose page language" />
    </div>
  );
}
