/**
 * Spolehlivé ukládání interakčního logu mimo jsPsych (sessionStorage + záloha v paměti).
 * Každá akce se zapíše okamžitě; při exportu je k dispozici celý seznam action_logs.
 */
(function (global) {
  const PREFIX = 'digitool_action_logs_';

  const scopeKey = (respondentId, scope) =>
    `${PREFIX}${respondentId || 'anon'}_${scope || 'default'}`;

  const read = (respondentId, scope) => {
    try {
      const raw = sessionStorage.getItem(scopeKey(respondentId, scope));
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map((entry) => sanitizeEntry(entry)) : [];
    } catch (e) {
      console.warn('DigitoolActionLogStore.read failed', e);
      return [];
    }
  };

  const write = (respondentId, scope, entries) => {
    try {
      sessionStorage.setItem(
        scopeKey(respondentId, scope),
        JSON.stringify(Array.isArray(entries) ? entries : [])
      );
      return true;
    } catch (e) {
      console.warn('DigitoolActionLogStore.write failed', e);
      return false;
    }
  };

  const clear = (respondentId, scope) => {
    try {
      sessionStorage.removeItem(scopeKey(respondentId, scope));
    } catch (e) {
      console.warn('DigitoolActionLogStore.clear failed', e);
    }
  };

  const CZECH_RE = /[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/;

  /** Czech UI text that was stored verbatim -> English code for what it records. */
  const CZECH_CODE = {
    Ano: 'yes',
    Ne: 'no',
    Nevím: 'unsure',
    'Ano, souhlasím.': 'agreed',
    muzu: 'can_draw_one_stroke',
    nemuzu: 'cannot_draw_one_stroke',
    divka: 'girl',
    chlapec: 'boy',
    Dívka: 'girl',
    Chlapec: 'boy',
    Kornouty: 'cones',
    'Dva domečky': 'two_houses',
    'Dva trojúhelníky': 'two_triangles',
    'Tři trojúhelníky': 'three_triangles',
    'Čtyřúhelník s úhlopříčkami': 'quadrilateral_with_diagonals',
    Váza: 'vase',
    'Vím jistě, že mám úlohu správně.': 'sure_correct',
    'Myslím si, že mám úlohu správně.': 'think_correct',
    'Nevím jistě, zda mám úlohu správně.': 'unsure',
    'Myslím si, že mám v úloze chybu, ale už nechci pokračovat v řešení.': 'think_error',
    'Chci ještě pokračovat v řešení.': 'continue_solving',
    'Uprav velikost hradů podle toho, kolik z nich vede cest.': 'scale_castles_by_degree',
    'Zvýrazni mi všechny cesty vedoucí z jednoho hradu.': 'highlight_incident_edges',
    'Zkontroluj mi hrady, u kterých už mám číslo.': 'check_filled_castles',
    'Spočítej mi aktuální počet nakreslených cest.': 'count_drawn_edges',
    'Poraď mi, u jakého hradu mám teď vytvořit cesty.': 'suggest_next_castle',
    'Zkontroluj, jestli mám zatím úlohu správně.': 'check_progress',
    'Spočítej počet cest u každé hvězdy.': 'count_star_edges',
    'Ukaž mi, kudy vést cestu jedním tahem.': 'guide_one_stroke_path',
    'Ukaž mi můj poslední postup.': 'replay_last_attempt',
    'Poraď mi, jak rozlišit, které cesty jdou nakreslit.': 'distinguish_drawable_paths',
    'Poraď mi, které cesty odstranit.': 'suggest_edges_to_remove',
    'Vyznač mi, které plodiny už v cestě mám.': 'mark_crops_on_path',
    'Poraď mi, kde je nejlepší začít.': 'suggest_start',
    'Zkontroluj mi zatím vyplněná políčka.': 'check_filled_cells',
    'Nevím, které čáry přidat nebo odebrat.': 'which_lines_to_edit'
  };

  const mapLoggedText = (value) => {
    if (typeof value !== 'string') return value;
    if (Object.prototype.hasOwnProperty.call(CZECH_CODE, value)) return CZECH_CODE[value];
    if (/^Doplň jednu plodinu nebo barvu za mě\b/.test(value)) return 'wand_fill_one_item';
    return value;
  };

  const sanitizeEntry = (entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    if (Array.isArray(entry)) return entry.map((item) => sanitizeEntry(item));
    const out = {};
    Object.keys(entry).forEach((key) => {
      const value = entry[key];
      if (Array.isArray(value) || (value && typeof value === 'object')) {
        out[key] = sanitizeEntry(value);
      } else {
        out[key] = mapLoggedText(value);
      }
    });
    if (out.action === 'ghost_q1_answered') out.question = 'prior_similar_task';
    if (out.action === 'self_assessment_chosen' || out.action === 'self_assessment_dialog_opened') {
      out.question = 'solution_confidence';
    }
    if (out.action === 'euler2_panel_yesno') out.question = 'one_stroke_possible';
    if (out.action === 'research_consent_given') out.question = 'research_participation_consent';
    if (out.action === 'demography_gender_selected') out.question = 'gender';
    if (out.action === 'demography_class_selected') out.question = 'school_grade';
    if (out.self_assessment_label) {
      if (!out.self_assessment) out.self_assessment = out.self_assessment_label;
      delete out.self_assessment_label;
    }
    if (out.hint_key && out.label) delete out.label;
    if (out.action === 'research_consent_given') delete out.label;
    if (out.graph_label) {
      out.figure = out.graph_label;
      delete out.graph_label;
    }
    Object.keys(out).forEach((key) => {
      if (typeof out[key] === 'string' && CZECH_RE.test(out[key])) delete out[key];
    });
    return out;
  };

  const append = (respondentId, scope, entry) => {
    const arr = read(respondentId, scope);
    arr.push(sanitizeEntry(entry));
    write(respondentId, scope, arr);
    return arr;
  };

  const normalizeEntry = (item) => {
    if (typeof item !== 'object' || item === null) {
      return sanitizeEntry({ time: Date.now(), action: String(item) });
    }
    const entry = item.time ? { ...item } : { time: Date.now(), ...item };
    if (!entry.action && entry.type) {
      entry.action = entry.type;
      delete entry.type;
    }
    if (!entry.action) entry.action = 'unknown_action';
    return sanitizeEntry(entry);
  };

  /** Přepojí .push() na poli tak, aby každý zápis šel i do sessionStorage. */
  const wireArray = (respondentId, scope, memoryArray, options = {}) => {
    const { reset = false, taskName = null } = options;
    if (reset) clear(respondentId, scope);
    const rawPush = memoryArray.push.bind(memoryArray);
    memoryArray.push = function (...items) {
      items.forEach((item) => {
        const entry = normalizeEntry(item);
        if (taskName && !entry.task_name) entry.task_name = taskName;
        rawPush(entry);
        append(respondentId, scope, entry);
      });
      return memoryArray.length;
    };
    return memoryArray;
  };

  /** Vytvoří logger: zapisuje do paměťového pole i do sessionStorage. */
  const createLogger = (respondentId, scope, memoryArray, options = {}) => {
    const { reset = false } = options;
    if (reset) clear(respondentId, scope);
    const log = (action, detail = {}) => {
      const entry = {
        time: Date.now(),
        action,
        ...detail
      };
      memoryArray.push(entry);
      append(respondentId, scope, entry);
      return entry;
    };
    return log;
  };

  const bindTrialOnFinish = (trialOrTrials, getMemoryLogs, scope) => {
    if (Array.isArray(trialOrTrials)) {
      const respondentId = getMemoryLogs;
      const sc = scope || 'default';
      return trialOrTrials.map((trial) =>
        bindTrialOnFinish(trial, () => read(respondentId, sc))
      );
    }
    const trial = trialOrTrials;
    const prev = trial.on_finish;
    trial.on_finish = function (data) {
      const logs =
        typeof getMemoryLogs === 'function' ? getMemoryLogs() : getMemoryLogs;
      if (Array.isArray(logs) && logs.length > 0) {
        data.action_logs = logs.map((e) => normalizeEntry(e));
      }
      if (typeof prev === 'function') prev.call(this, data);
    };
    return trial;
  };

  const mergeTrialsWithStoredLogs = (trials, storedLogs) => {
    if (!Array.isArray(trials)) return [];
    if (!storedLogs.length) return trials;
    const hasAnyTrialLogs = trials.some(
      (t) => Array.isArray(t.action_logs) && t.action_logs.length > 0
    );
    if (hasAnyTrialLogs) return trials;
    return trials.map((t, i) => {
      const name = t.task_name;
      let logs = [];
      if (name) {
        logs = storedLogs.filter((e) => e.task_name === name);
      }
      if (!logs.length && i === trials.length - 1) {
        logs = storedLogs;
      }
      return { ...t, action_logs: logs };
    });
  };

  // FI verze: odesílání a ukládání loglistu přes Google Apps Script je vypnuté.
  // Obnovení: smaž prázdný řetězec a odkomentuj původní URL na dalším řádku.
  const UPLOAD_URL = '';
  // const UPLOAD_URL = 'https://script.google.com/macros/s/AKfycbyANMdl655_EgkUClCXONgoYJszYTA9t3k3Ed-JYhLoUYvfM_95sQasW_Er1oJKQCI/exec';
  const MIN_UPLOAD_GAP_MS = 3 * 60 * 1000;
  let uploadBusy = false;

  const uploadStateKey = (respondentId, scope) =>
    `digitool_upload_state_${scope || 'uloha'}_${respondentId || 'bez_id'}`;

  const readUploadState = (respondentId, scope) => {
    try {
      const raw = sessionStorage.getItem(uploadStateKey(respondentId, scope));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  };

  const writeUploadState = (respondentId, scope, signature) => {
    try {
      sessionStorage.setItem(uploadStateKey(respondentId, scope), JSON.stringify({
        signature,
        at: Date.now()
      }));
    } catch (e) { /* ignore */ }
  };

  const logSignature = (respondentId, scope) => {
    const logs = read(respondentId, scope);
    if (!logs.length) return '';
    const last = logs[logs.length - 1] || {};
    return `${scope || ''}|${respondentId || ''}|${logs.length}|${last.time || ''}|${last.action || ''}`;
  };

  const buildActionLogsBody = (respondentId, scope) => {
    const logs = read(respondentId, scope).map((entry) => ({ ...entry }));
    if (!logs.length) return null;
    const safeId = String(respondentId || 'bez_id').replace(/[^\w.-]+/g, '_');
    const filename = `DigiTool_FI_${safeId}_${scope || 'uloha'}_prubeh.json`;
    const content = JSON.stringify({
      respondent_id: respondentId || null,
      task: scope || null,
      partial: true,
      saved_at: new Date().toISOString(),
      action_logs: logs
    });
    return 'payload=' + encodeURIComponent(JSON.stringify({ filename, content }));
  };

  const postPayload = (body) => {
    // FI verze: odeslání je vypnuté. Obnovení: smaž return a odkomentuj blok níže
    // a zároveň obnov UPLOAD_URL výše.
    return Promise.resolve(false);
    /*
    return fetch(UPLOAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body
    }).then((res) => res.text()).then((text) => {
      if (text.indexOf('"ok":false') !== -1 || text.indexOf('"ok": false') !== -1) return false;
      return true;
    });
    */
  };

  const uploadActionLogsCopy = (respondentId, scope, options = {}) => {
    if (!UPLOAD_URL || uploadBusy) return Promise.resolve(false);
    const signature = logSignature(respondentId, scope);
    if (!signature) return Promise.resolve(false);
    const state = readUploadState(respondentId, scope);
    if (state && state.signature === signature) return Promise.resolve(false);
    if (!options.force && state && Date.now() - state.at < MIN_UPLOAD_GAP_MS) return Promise.resolve(false);
    const body = buildActionLogsBody(respondentId, scope);
    if (!body) return Promise.resolve(false);
    uploadBusy = true;
    writeUploadState(respondentId, scope, signature);
    return postPayload(body).catch((err) => {
      console.warn('DigiTool průběžné odeslání logu:', err);
      return true;
    }).then((ok) => {
      if (!ok) {
        try { sessionStorage.removeItem(uploadStateKey(respondentId, scope)); } catch (e) { /* ignore */ }
      }
      return ok;
    }).finally(() => {
      uploadBusy = false;
    });
  };

  const watchProgress = (respondentId, scope) => {
    // FI verze: průběžné odesílání je vypnuté, dokud není obnovené UPLOAD_URL.
    if (!UPLOAD_URL) return;
    setInterval(() => {
      uploadActionLogsCopy(respondentId, scope);
    }, MIN_UPLOAD_GAP_MS);
    window.addEventListener('pagehide', () => {
      const signature = logSignature(respondentId, scope);
      const state = readUploadState(respondentId, scope);
      if (!signature || (state && state.signature === signature)) return;
      const body = buildActionLogsBody(respondentId, scope);
      if (!body || !navigator.sendBeacon) return;
      writeUploadState(respondentId, scope, signature);
      const blob = new Blob([body], { type: 'application/x-www-form-urlencoded;charset=utf-8' });
      // FI verze: beacon je vypnutý. Obnovení: odkomentuj řádek níže.
      // try { navigator.sendBeacon(UPLOAD_URL, blob); } catch (e) { /* ignore */ }
      void blob;
    });
  };

  const TASK_EXPORT_SCOPES = [
    { block: 'euler', scope: 'euler', resultKey: 'euler' },
    { block: 'degree_sequence', scope: 'degree', resultKey: 'degree' },
    { block: 'park', scope: 'park', resultKey: 'park' }
  ];

  const readLocalJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  };

  const resolveRespondentId = () => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('rid');
      if (fromUrl) return fromUrl;
    } catch (e) { /* ignore */ }
    const session = readLocalJson('digitool_active_session', null);
    return session && session.respondent_id ? session.respondent_id : null;
  };

  const logsFromTaskResult = (taskResult) => {
    if (!taskResult || typeof taskResult !== 'object') return [];
    if (Array.isArray(taskResult.action_logs) && taskResult.action_logs.length) {
      return taskResult.action_logs.map((entry) => sanitizeEntry(entry));
    }
    const trials = Array.isArray(taskResult.trials) ? taskResult.trials : [];
    return trials.flatMap((trial) =>
      Array.isArray(trial && trial.action_logs) ? trial.action_logs.map((entry) => sanitizeEntry(entry)) : []
    );
  };

  const buildFinnishLoglistFile = () => {
    const respondentId = resolveRespondentId();
    const session = readLocalJson('digitool_active_session', null);
    const results = readLocalJson('digitool_results', {});
    const hubLogs = Array.isArray(session && session.logs)
      ? session.logs.map((entry) => sanitizeEntry(entry))
      : [];
    const merged = [];
    hubLogs.forEach((entry) => {
      merged.push(sanitizeEntry({ ...entry, task_block: entry.task_block || 'hub' }));
    });
    TASK_EXPORT_SCOPES.forEach(({ block, scope, resultKey }) => {
      const live = respondentId ? read(respondentId, scope) : [];
      const stored = logsFromTaskResult(results && results[resultKey]);
      const logs = live.length ? live : stored;
      logs.forEach((entry) => {
        merged.push(sanitizeEntry({ ...entry, task_block: entry.task_block || block }));
      });
    });
    merged.sort((a, b) => (a.time || 0) - (b.time || 0));
    const exportedAt = new Date();
    return {
      exportedAt,
      respondentId,
      empty: merged.length === 0,
      payload: {
        digitool_version: 'fi',
        exported_at: exportedAt.toISOString(),
        respondent_id: respondentId,
        started_at: session && session.started_at ? session.started_at : null,
        demographics: session && session.demographics ? session.demographics : null,
        hub_logs: hubLogs,
        loglist: merged,
        all_action_logs: merged,
        euler: results && results.euler ? results.euler : null,
        degree_sequence: results && results.degree ? results.degree : null,
        park: results && results.park ? results.park : null
      }
    };
  };

  const showDownloadNotice = (message) => {
    let notice = document.getElementById('digitool-download-notice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'digitool-download-notice';
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      document.body.appendChild(notice);
    }
    notice.textContent = message;
    notice.classList.add('visible');
    clearTimeout(showDownloadNotice._timer);
    showDownloadNotice._timer = setTimeout(() => notice.classList.remove('visible'), 4500);
  };

  const downloadLoglist = () => {
    const file = buildFinnishLoglistFile();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${file.exportedAt.getFullYear()}${pad(file.exportedAt.getMonth() + 1)}${pad(file.exportedAt.getDate())}_${pad(file.exportedAt.getHours())}${pad(file.exportedAt.getMinutes())}${pad(file.exportedAt.getSeconds())}`;
    const safeId = String(file.respondentId || 'bez_id').replace(/[^\w.-]+/g, '_');
    const filename = `DigiTool_FI_${safeId}_${stamp}.json`;
    const blob = new Blob([JSON.stringify(file.payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    showDownloadNotice(
      file.empty
        ? 'Tietoja ei ole vielä tallennettu. Tiedosto ladattiin silti.'
        : 'Tiedot ladattiin tähän laitteeseen.'
    );
    return filename;
  };

  const mountDownloadButton = () => {
    if (!document.body || document.getElementById('digitool-download-loglist')) return;
    if (!document.getElementById('digitool-download-loglist-style')) {
      const style = document.createElement('style');
      style.id = 'digitool-download-loglist-style';
      style.textContent = [
        '#digitool-download-loglist{position:fixed;top:12px;right:12px;z-index:4000;border:none;border-radius:8px;padding:10px 14px;background:#1f2a44;color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:"Segoe UI",Tahoma,Geneva,Verdana,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.18);}',
        '#digitool-download-loglist:hover{background:#2a3b63;}',
        '#digitool-download-notice{position:fixed;top:58px;right:12px;z-index:4000;max-width:min(320px,calc(100% - 24px));padding:12px 14px;border-radius:10px;background:#1f2a44;color:#fff;font-size:14px;font-weight:700;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.2);opacity:0;pointer-events:none;transition:opacity .2s ease;font-family:"Segoe UI",Tahoma,Geneva,Verdana,sans-serif;}',
        '#digitool-download-notice.visible{opacity:1;}'
      ].join('');
      document.head.appendChild(style);
    }
    const button = document.createElement('button');
    button.id = 'digitool-download-loglist';
    button.type = 'button';
    button.textContent = 'Lataa tiedot';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      downloadLoglist();
    });
    document.body.appendChild(button);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountDownloadButton);
  } else {
    mountDownloadButton();
  }

  global.DigitoolActionLogStore = {
    read,
    write,
    clear,
    append,
    normalizeEntry,
    sanitizeEntry,
    wireArray,
    createLogger,
    bindTrialOnFinish,
    mergeTrialsWithStoredLogs,
    uploadActionLogsCopy,
    sendActionLogsBeacon: () => false,
    watchProgress,
    downloadLoglist
  };
})(typeof window !== 'undefined' ? window : globalThis);
