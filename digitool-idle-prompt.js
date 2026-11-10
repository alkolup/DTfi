/**
 * Po 45 s neaktivity zobrazí ducha s nabídkou nápovědy.
 * Vyžaduje logAction(action, detail) — zapisuje idle_prompt_shown / _work / _help.
 */
const DIGITOOL_IDLE_MS = 45 * 1000;

let digitoolIdleDispose = () => {};

const disposeDigitoolIdleTimer = () => {
  digitoolIdleDispose();
  digitoolIdleDispose = () => {};
};

const setupDigitoolIdleGhostPrompt = (opts) => {
  const {
    logAction,
    isIdleAllowed,
    ghostText,
    ghostButtons,
    ghostBubble,
    ghostUI,
    onRequestHelp,
    defaultGhostHtml = '',
    defaultGhostButtonsHtml = ''
  } = opts;

  disposeDigitoolIdleTimer();
  let timerId = null;
  const clearTimer = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  };
  const logIdle = (action, detail = {}) => {
    if (typeof logAction === 'function') logAction(action, detail);
  };
  const armTimer = () => {
    clearTimer();
    timerId = setTimeout(showIdlePrompt, DIGITOOL_IDLE_MS);
  };
  const showIdlePrompt = () => {
    if (!isIdleAllowed()) {
      armTimer();
      return;
    }
    logIdle('idle_prompt_shown');
    ghostText.textContent = 'Tarvitsetko vihjettä?';
    ghostButtons.style.flexDirection = 'column';
    ghostButtons.innerHTML =
      '<button type="button" id="digitool-idle-work" style="padding: 10px 15px; border: none; border-radius: 8px; background: #28a745; color: white; cursor: pointer; font-weight: bold; font-size: 14px;">Haluan tehdä tehtävää.</button>' +
      '<button type="button" id="digitool-idle-help" style="padding: 10px 15px; border: none; border-radius: 8px; background: #007bff; color: white; cursor: pointer; font-weight: bold; font-size: 14px;">Haluan vihjeen.</button>';
    ghostBubble.classList.add('visible');
    ghostUI.style.transform = 'scale(1)';
    document.getElementById('digitool-idle-work').addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
        logIdle('idle_prompt_work');
        ghostBubble.classList.remove('visible');
        ghostUI.style.transform = 'scale(0.6)';
        ghostText.innerHTML = defaultGhostHtml;
        ghostButtons.innerHTML = defaultGhostButtonsHtml;
        armTimer();
      },
      { once: true }
    );
    document.getElementById('digitool-idle-help').addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
        logIdle('idle_prompt_help');
        armTimer();
        if (typeof onRequestHelp === 'function') onRequestHelp();
      },
      { once: true }
    );
  };
  const onActivity = () => armTimer();
  document.addEventListener('click', onActivity, true);
  document.addEventListener('pointerdown', onActivity, true);
  armTimer();
  digitoolIdleDispose = () => {
    clearTimer();
    document.removeEventListener('click', onActivity, true);
    document.removeEventListener('pointerdown', onActivity, true);
    digitoolIdleDispose = () => {};
  };
};
