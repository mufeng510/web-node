import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Moves focus to the page heading on navigation and announces the page name.
 *
 * A client-side route change leaves focus wherever it was — usually on a link in
 * the rail that has just been swapped out — so a keyboard or screen-reader user
 * is left with no indication that anything happened and Tab continues from a
 * detached element.
 */
export function useRouteFocus() {
  const location = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const heading = document.querySelector<HTMLElement>(
      '#main-content h1, #main-content [role="heading"]'
    );
    // `focus()` on a heading is a silent no-op unless it carries tabIndex, so a
    // page whose heading is not focusable falls back to #main-content, which is
    // always focusable, instead of leaving focus on a link that just unmounted.
    const target = heading?.hasAttribute('tabindex')
      ? heading
      : document.getElementById('main-content');
    target?.focus();

    const name = heading?.textContent?.trim();
    if (!name) return;

    const announcer = document.getElementById('route-announcer');
    if (announcer) announcer.textContent = name;
  }, [location.pathname, location.search]);
}
