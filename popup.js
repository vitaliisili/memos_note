/* ═══════════════════════════════════════════════════════════════
   Memos – Private Notes  |  popup.js
   ═══════════════════════════════════════════════════════════════ */

/* ── State ─────────────────────────────────────────────────── */
let serverUrl = '';
let token = '';
let userName = '';
let allNotes = [];
let searchQuery = '';
let selectedNote = null;
let currentNoteName = null;
let tiptapEditor = null;
let autoSaveTimer = null;
let isSaving = false;
let hasUnsavedChanges = false;
let editorMode = 'tiptap'; // 'tiptap' | 'markdown' | 'plaintext'
let isPreviewMode = false;  // true = showing rendered preview (markdown/plaintext)

/* ── DOM refs ──────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

const screenSetup    = $('screen-setup');
const screenNotes    = $('screen-notes');
const inputUrl       = $('input-url');
const inputToken     = $('input-token');
const setupError     = $('setup-error');
const btnConnect     = $('btn-connect');
const connectLabel   = $('connect-label');
const connectSpinner = $('connect-spinner');

const btnNew         = $('btn-new');
const searchInput    = $('search-input');
const notesList      = $('notes-list');
const emptyState     = $('empty-state');
const notesCount     = $('notes-count');
const notesError     = $('notes-error');

const rightEmpty       = $('right-empty');
const editorPane       = $('editor-pane');
const modeTabs         = $('mode-tabs');
const tabPreview       = $('tab-preview');
const tabEdit          = $('tab-edit');
const editorToolbar    = document.querySelector('.editor-toolbar');
const editorContainer  = $('editor-container');
const textEditor       = $('text-editor');
const previewPane      = $('preview-pane');
const previewContent   = $('preview-content');
const saveStatus       = $('save-status');
const noteVisibility   = $('note-visibility');
const btnCopyLink      = $('btn-copy-link');
const btnOpenMemos     = $('btn-open-memos');
const btnDeleteCurrent = $('btn-delete-current');

const btnSettings      = $('btn-settings');
const settingsOverlay  = $('settings-overlay');
const btnCloseSettings = $('btn-close-settings');
const settingTheme     = $('setting-theme');
const settingEditor    = $('setting-editor');
const settingDisplay   = $('setting-display');
const settingServerUrl = $('setting-server-url');
const btnDisconnect    = $('btn-disconnect');

/* ── Markdown toolbar actions (for textarea mode) ──────────── */
var mdActions = {
  bold:        { pre: '**', suf: '**', ph: 'bold' },
  italic:      { pre: '_', suf: '_', ph: 'italic' },
  underline:   { pre: '<u>', suf: '</u>', ph: 'underline' },
  strike:      { pre: '~~', suf: '~~', ph: 'strikethrough' },
  h1:          { pre: '# ', suf: '', ph: 'Heading', ln: true },
  h2:          { pre: '## ', suf: '', ph: 'Heading', ln: true },
  h3:          { pre: '### ', suf: '', ph: 'Heading', ln: true },
  bulletList:  { pre: '- ', suf: '', ph: 'item', ln: true },
  orderedList: { pre: '1. ', suf: '', ph: 'item', ln: true },
  taskList:    { pre: '- [ ] ', suf: '', ph: 'task', ln: true },
  code:        { pre: '`', suf: '`', ph: 'code' },
  codeBlock:   { pre: '```\n', suf: '\n```', ph: 'code' },
  blockquote:  { pre: '> ', suf: '', ph: 'quote', ln: true },
  link:        { pre: '[', suf: '](url)', ph: 'link text' },
  hr:          { pre: '\n---\n', suf: '', ph: '' },
};

/* ── Markdown rendering ────────────────────────────────────── */
marked.setOptions({ breaks: true, gfm: true });

function renderMarkdown(md) {
  var raw = marked.parse(md || '');
  var clean = DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ['h1','h2','h3','h4','h5','h6','p','br','hr','strong','em','del','s',
      'a','code','pre','blockquote','ul','ol','li','table','thead','tbody','tr','th','td',
      'img','input','span','div','sub','sup'],
    ALLOWED_ATTR: ['href','src','alt','title','target','rel','type','checked','disabled','class'],
    ALLOW_DATA_ATTR: false,
  });
  return clean;
}

/* ── API helper ────────────────────────────────────────────── */
function api(path, opts) {
  var o = opts || {};
  var headers = { 'Authorization': 'Bearer ' + token };
  if (o.body) headers['Content-Type'] = 'application/json';
  return fetch(serverUrl + path, {
    method: o.method || 'GET',
    headers: headers,
    body: o.body || undefined,
  });
}

/* ── Init ──────────────────────────────────────────────────── */
chrome.storage.local.get(
  ['serverUrl', 'token', 'userName', 'theme', 'displayMode', 'editorMode'],
  function (data) {
    applyTheme(data.theme || 'dark');
    settingTheme.value = data.theme || 'dark';
    settingDisplay.value = data.displayMode || 'popup';

    // In popup mode, set fixed dimensions
    var isPopup = (data.displayMode || 'popup') === 'popup';
    if (isPopup) document.body.classList.add('popup-mode');

    editorMode = data.editorMode || 'tiptap';
    settingEditor.value = editorMode;
    applyEditorMode(editorMode);

    if (data.serverUrl && data.token) {
      serverUrl = data.serverUrl;
      token = data.token;
      userName = data.userName || '';
      settingServerUrl.textContent = serverUrl;
      showNotesScreen();
    } else {
      showSetupScreen();
    }
  }
);

/* ── Theme ─────────────────────────────────────────────────── */
function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
}

/* ── Editor Mode ───────────────────────────────────────────── */
function applyEditorMode(mode) {
  editorMode = mode;
  document.body.setAttribute('data-editor', mode);
  isPreviewMode = false;
}

function switchEditorMode(mode) {
  // Save current content before switching
  var currentContent = getEditorContent();

  // Destroy tiptap if switching away
  if (editorMode === 'tiptap' && mode !== 'tiptap' && tiptapEditor) {
    tiptapEditor.destroy();
    tiptapEditor = null;
  }

  applyEditorMode(mode);
  chrome.storage.local.set({ editorMode: mode });

  // If we have an active note, reload content in new editor
  if (editorPane && !editorPane.classList.contains('hidden')) {
    showEditorForMode(mode);
    setEditorContent(currentContent);
  }
}

function showEditorForMode(mode) {
  // Hide all editor areas first
  editorContainer.classList.add('hidden');
  textEditor.classList.add('hidden');
  previewPane.classList.add('hidden');

  if (mode === 'tiptap') {
    editorContainer.classList.remove('hidden');
    editorToolbar.classList.remove('hidden');
    modeTabs.classList.add('hidden');
    ensureTiptap();
  } else {
    if (mode === 'markdown') {
      modeTabs.classList.remove('hidden');
      textEditor.placeholder = 'Write in Markdown...\n\n# Heading\n**bold** _italic_ ~~strike~~';

      if (currentNoteName && !hasUnsavedChanges) {
        enterPreviewMode();
      } else {
        enterEditMode();
      }
    } else {
      // Plain text: no tabs, no toolbar, straight to editing
      modeTabs.classList.add('hidden');
      editorToolbar.classList.add('hidden');
      textEditor.classList.remove('hidden');
      textEditor.placeholder = 'Write your note...';
      isPreviewMode = false;
    }
  }
}

function enterPreviewMode() {
  isPreviewMode = true;
  textEditor.classList.add('hidden');
  editorContainer.classList.add('hidden');
  previewPane.classList.remove('hidden');
  editorToolbar.classList.add('hidden');

  // Render content
  var content = textEditor.value || (selectedNote ? (selectedNote.content || '') : '');
  previewContent.innerHTML = renderMarkdown(content);

  previewContent.querySelectorAll('a').forEach(function (a) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });

  // Update tabs
  tabPreview.classList.add('active');
  tabEdit.classList.remove('active');
}

function enterEditMode() {
  isPreviewMode = false;
  previewPane.classList.add('hidden');
  editorContainer.classList.add('hidden');
  textEditor.classList.remove('hidden');

  if (editorMode === 'markdown') {
    editorToolbar.classList.remove('hidden');
  } else {
    editorToolbar.classList.add('hidden');
  }

  // Update tabs
  tabPreview.classList.remove('active');
  tabEdit.classList.add('active');

  textEditor.focus();
}

function getEditorContent() {
  if (editorMode === 'tiptap' && tiptapEditor) {
    return tiptapEditor.getMarkdown().trim();
  }
  return textEditor.value.trim();
}

function setEditorContent(content) {
  if (editorMode === 'tiptap' && tiptapEditor) {
    tiptapEditor.setMarkdown(content || '');
  } else {
    textEditor.value = content || '';
    // If in preview mode, also update the rendered view
    if (isPreviewMode) {
      previewContent.innerHTML = renderMarkdown(content || '');
      previewContent.querySelectorAll('a').forEach(function (a) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      });
    }
  }
}

function focusEditor() {
  if (editorMode === 'tiptap' && tiptapEditor) {
    tiptapEditor.focus();
  } else {
    textEditor.focus();
  }
}

/* ── Screens ───────────────────────────────────────────────── */
function showSetupScreen() {
  screenSetup.classList.remove('hidden');
  screenNotes.classList.add('hidden');
  inputUrl.focus();
}

function showNotesScreen() {
  screenSetup.classList.add('hidden');
  screenNotes.classList.remove('hidden');
  loadNotes();
}

/* ── Setup / Auth ──────────────────────────────────────────── */
btnConnect.addEventListener('click', async function () {
  var url = inputUrl.value.trim().replace(/\/+$/, '');
  var tok = inputToken.value.trim();

  if (!url || !tok) { showSetupError('Please fill in both fields.'); return; }

  setConnectLoading(true);
  hideSetupError();

  try {
    var authEndpoints = ['/api/v1/auth/status', '/api/v1/users/me', '/api/v1/auth/me'];
    var res = null;
    var user = null;

    for (var ep of authEndpoints) {
      var r = await fetch(url + ep, {
        headers: { 'Authorization': 'Bearer ' + tok },
      });
      if (r.status === 401) { showSetupError('Invalid access token.'); return; }
      if (r.ok) { res = r; user = await r.json(); break; }
    }

    if (!res) { showSetupError('Server error. Check your URL.'); return; }
    serverUrl = url;
    token = tok;
    userName = user.name || '';
    settingServerUrl.textContent = serverUrl;
    chrome.storage.local.set({ serverUrl: serverUrl, token: token, userName: userName });
    showNotesScreen();
  } catch (e) {
    showSetupError('Cannot reach server. Check the URL and your network.');
  } finally {
    setConnectLoading(false);
  }
});

[inputUrl, inputToken].forEach(function (el) {
  el.addEventListener('keydown', function (e) { if (e.key === 'Enter') btnConnect.click(); });
});

function setConnectLoading(on) {
  connectLabel.classList.toggle('hidden', on);
  connectSpinner.classList.toggle('hidden', !on);
  btnConnect.disabled = on;
}
function showSetupError(msg) {
  setupError.textContent = msg;
  setupError.classList.remove('hidden');
}
function hideSetupError() { setupError.classList.add('hidden'); }

/* ── Disconnect ────────────────────────────────────────────── */
function disconnect() {
  chrome.storage.local.remove(['serverUrl', 'token', 'userName'], function () {
    serverUrl = '';
    token = '';
    userName = '';
    allNotes = [];
    selectedNote = null;
    currentNoteName = null;
    hasUnsavedChanges = false;
    if (tiptapEditor) { tiptapEditor.destroy(); tiptapEditor = null; }
    textEditor.value = '';
    inputUrl.value = '';
    inputToken.value = '';
    closeSettings();
    showSetupScreen();
  });
}
btnDisconnect.addEventListener('click', disconnect);

/* ── TipTap Editor ─────────────────────────────────────────── */
function ensureTiptap() {
  if (tiptapEditor) return;

  rightEmpty.classList.add('hidden');
  editorPane.classList.remove('hidden');

  tiptapEditor = window.createMemosEditor(editorContainer, {
    placeholder: 'Start writing your note...',
    content: '',
    onUpdate: function () {
      hasUnsavedChanges = true;
      scheduleAutoSave();
      updateToolbarState();
    },
  });
}

/* ── Text editor events (markdown/plaintext) ───────────────── */
textEditor.addEventListener('input', function () {
  hasUnsavedChanges = true;
  scheduleAutoSave();
});

/* ── Open note / New note ──────────────────────────────────── */
function openNoteInEditor(note) {
  selectedNote = note;
  currentNoteName = note ? note.name : null;
  hasUnsavedChanges = false;
  clearAutoSave();

  rightEmpty.classList.add('hidden');
  editorPane.classList.remove('hidden');
  showEditorForMode(editorMode);

  setEditorContent(note ? (note.content || '') : '');
  focusEditor();
  setSaveStatus('');

  // Set visibility from note
  noteVisibility.value = (note && note.visibility) ? note.visibility : 'PRIVATE';

  notesList.querySelectorAll('.note-item').forEach(function (el) {
    el.classList.toggle('active', note && el.dataset.name === note.name);
  });
}

function openNewNote() {
  selectedNote = null;
  currentNoteName = null;
  hasUnsavedChanges = false;
  clearAutoSave();

  rightEmpty.classList.add('hidden');
  editorPane.classList.remove('hidden');
  showEditorForMode(editorMode);

  setEditorContent('');
  focusEditor();
  setSaveStatus('');
  noteVisibility.value = 'PRIVATE';

  notesList.querySelectorAll('.note-item.active').forEach(function (el) {
    el.classList.remove('active');
  });
}

/* ── Auto-save ─────────────────────────────────────────────── */
function scheduleAutoSave() {
  clearAutoSave();
  setSaveStatus('saving');
  autoSaveTimer = setTimeout(doAutoSave, 1200);
}

function clearAutoSave() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
}

async function doAutoSave() {
  if (isSaving) return;

  var md = getEditorContent();
  if (!md) {
    setSaveStatus('');
    hasUnsavedChanges = false;
    return;
  }

  isSaving = true;
  setSaveStatus('saving');

  try {
    var vis = noteVisibility.value || 'PRIVATE';

    if (currentNoteName) {
      // Check if visibility changed too
      var updateFields = 'content';
      var body = { content: md };
      if (selectedNote && selectedNote.visibility !== vis) {
        updateFields += ',visibility';
        body.visibility = vis;
      }

      var res = await api('/api/v1/' + currentNoteName + '?updateMask=' + updateFields, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var updated = await res.json();

      var idx = allNotes.findIndex(function (n) { return n.name === currentNoteName; });
      if (idx !== -1) allNotes[idx] = updated;
      selectedNote = updated;
    } else {
      var res2 = await api('/api/v1/memos', {
        method: 'POST',
        body: JSON.stringify({ content: md, visibility: vis }),
      });
      if (!res2.ok) throw new Error('HTTP ' + res2.status);
      var created = await res2.json();

      allNotes.unshift(created);
      selectedNote = created;
      currentNoteName = created.name;
    }

    hasUnsavedChanges = false;
    setSaveStatus('saved');
    renderNotesList();

  } catch (err) {
    console.error('Auto-save failed:', err);
    setSaveStatus('error');
    showToast('Auto-save failed. Will retry...', true);
    autoSaveTimer = setTimeout(doAutoSave, 3000);
  } finally {
    isSaving = false;
  }
}

function setSaveStatus(state) {
  if (state === 'saving') {
    saveStatus.className = 'save-status saving';
    saveStatus.innerHTML = '<span class="save-dot"></span> Saving...';
  } else if (state === 'saved') {
    saveStatus.className = 'save-status saved';
    saveStatus.innerHTML = '<span class="save-dot"></span> Saved';
    setTimeout(function () {
      if (saveStatus.classList.contains('saved') && !hasUnsavedChanges) {
        saveStatus.className = 'save-status';
        saveStatus.textContent = '';
      }
    }, 2500);
  } else if (state === 'error') {
    saveStatus.className = 'save-status';
    saveStatus.style.color = 'var(--danger)';
    saveStatus.textContent = 'Save failed';
  } else {
    saveStatus.className = 'save-status';
    saveStatus.innerHTML = '';
  }
}

/* ── Toolbar ───────────────────────────────────────────────── */
editorToolbar.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-cmd]');
  if (!btn) return;

  var cmd = btn.dataset.cmd;

  if (editorMode === 'tiptap' && tiptapEditor) {
    handleTiptapCommand(cmd);
    updateToolbarState();
  } else if (editorMode === 'markdown') {
    handleMarkdownCommand(cmd);
  }
});

function handleTiptapCommand(cmd) {
  switch (cmd) {
    case 'bold':        tiptapEditor.toggleBold(); break;
    case 'italic':      tiptapEditor.toggleItalic(); break;
    case 'underline':   tiptapEditor.toggleUnderline(); break;
    case 'strike':      tiptapEditor.toggleStrike(); break;
    case 'code':        tiptapEditor.toggleCode(); break;
    case 'codeBlock':   tiptapEditor.toggleCodeBlock(); break;
    case 'bulletList':  tiptapEditor.toggleBulletList(); break;
    case 'orderedList': tiptapEditor.toggleOrderedList(); break;
    case 'taskList':    tiptapEditor.toggleTaskList(); break;
    case 'blockquote':  tiptapEditor.toggleBlockquote(); break;
    case 'h1':          tiptapEditor.toggleHeading(1); break;
    case 'h2':          tiptapEditor.toggleHeading(2); break;
    case 'h3':          tiptapEditor.toggleHeading(3); break;
    case 'hr':          tiptapEditor.setHorizontalRule(); break;
    case 'undo':        tiptapEditor.undo(); break;
    case 'redo':        tiptapEditor.redo(); break;
    case 'link':
      var url = prompt('Enter URL:');
      if (url) tiptapEditor.setLink(url);
      break;
  }
}

function handleMarkdownCommand(cmd) {
  if (cmd === 'link') {
    var url = prompt('Enter URL:');
    if (!url) return;
    insertMarkdown({ pre: '[', suf: '](' + url + ')', ph: 'link text' });
    return;
  }
  if (cmd === 'undo') { document.execCommand('undo'); return; }
  if (cmd === 'redo') { document.execCommand('redo'); return; }

  var action = mdActions[cmd];
  if (action) insertMarkdown(action);
}

function insertMarkdown(cfg) {
  var ta = textEditor;
  var start = ta.selectionStart;
  var end = ta.selectionEnd;
  var selected = ta.value.substring(start, end);
  var text = selected || cfg.ph || '';

  var insert;
  if (cfg.ln) {
    var before = ta.value.substring(0, start);
    var nl = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
    insert = nl + cfg.pre + text + cfg.suf;
  } else {
    insert = cfg.pre + text + cfg.suf;
  }

  ta.focus();
  document.execCommand('insertText', false, insert);

  if (!selected && cfg.ph) {
    var curPos = ta.selectionStart;
    var phStart = curPos - cfg.suf.length - cfg.ph.length;
    ta.setSelectionRange(phStart, phStart + cfg.ph.length);
  }
}

function updateToolbarState() {
  if (editorMode !== 'tiptap' || !tiptapEditor) return;
  document.querySelectorAll('.toolbar-btn[data-cmd]').forEach(function (btn) {
    var cmd = btn.dataset.cmd;
    var active = false;

    switch (cmd) {
      case 'bold':        active = tiptapEditor.isActive('bold'); break;
      case 'italic':      active = tiptapEditor.isActive('italic'); break;
      case 'underline':   active = tiptapEditor.isActive('underline'); break;
      case 'strike':      active = tiptapEditor.isActive('strike'); break;
      case 'code':        active = tiptapEditor.isActive('code'); break;
      case 'codeBlock':   active = tiptapEditor.isActive('codeBlock'); break;
      case 'bulletList':  active = tiptapEditor.isActive('bulletList'); break;
      case 'orderedList': active = tiptapEditor.isActive('orderedList'); break;
      case 'taskList':    active = tiptapEditor.isActive('taskList'); break;
      case 'blockquote':  active = tiptapEditor.isActive('blockquote'); break;
      case 'h1':          active = tiptapEditor.isActive('heading', { level: 1 }); break;
      case 'h2':          active = tiptapEditor.isActive('heading', { level: 2 }); break;
      case 'h3':          active = tiptapEditor.isActive('heading', { level: 3 }); break;
    }

    btn.classList.toggle('is-active', active);
  });
}

/* ── Load notes ────────────────────────────────────────────── */
async function loadNotes() {
  hideToast();
  renderSkeleton();

  try {
    var res = await api('/api/v1/memos?pageSize=100');
    if (res.status === 401) {
      showToast('Session expired. Please reconnect.', true);
      renderNotesList();
      return;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);

    var data = await res.json();
    allNotes = (data.memos || []).sort(function (a, b) {
      return new Date(b.updateTime || b.createTime) - new Date(a.updateTime || a.createTime);
    });
    renderNotesList();

    if (selectedNote) {
      var still = allNotes.find(function (n) { return n.name === selectedNote.name; });
      if (still) {
        selectedNote = still;
        notesList.querySelectorAll('.note-item').forEach(function (el) {
          el.classList.toggle('active', el.dataset.name === still.name);
        });
      }
    }
  } catch (err) {
    console.error('loadNotes:', err);
    showToast('Failed to load notes.', true);
    renderNotesList();
  }
}

/* ── Render notes list ─────────────────────────────────────── */
function renderSkeleton() {
  notesList.innerHTML = '';
  for (var i = 0; i < 6; i++) {
    var div = document.createElement('div');
    div.className = 'skeleton-item';
    div.innerHTML =
      '<div class="skeleton" style="width:' + (50 + Math.random() * 40) + '%"></div>' +
      '<div class="skeleton" style="width:' + (35 + Math.random() * 30) + '%"></div>' +
      '<div class="skeleton" style="width:45px;height:8px;margin-top:4px"></div>';
    notesList.appendChild(div);
  }
  notesCount.textContent = '';
}

function renderNotesList() {
  var notes = filterNotes();
  notesList.innerHTML = '';
  notesList.appendChild(emptyState);

  if (!notes.length) {
    emptyState.classList.remove('hidden');
    notesCount.textContent = allNotes.length ? '0 / ' + allNotes.length : '';
    return;
  }
  emptyState.classList.add('hidden');

  notes.forEach(function (note) {
    notesList.appendChild(createNoteListItem(note));
  });

  notesCount.textContent = notes.length + ' note' + (notes.length !== 1 ? 's' : '');
}

function createNoteListItem(note) {
  var item = document.createElement('div');
  item.className = 'note-item';
  if (selectedNote && selectedNote.name === note.name) item.classList.add('active');
  item.dataset.name = note.name;

  var preview = extractPreview(note.content || '');

  var titleEl = document.createElement('div');
  titleEl.className = 'note-preview-title';
  titleEl.textContent = preview.title;

  var bodyEl = document.createElement('div');
  bodyEl.className = 'note-preview-body';
  bodyEl.textContent = preview.body;

  var dateEl = document.createElement('div');
  dateEl.className = 'note-date';
  dateEl.textContent = formatDate(note.updateTime || note.createTime);

  item.append(titleEl, bodyEl, dateEl);
  item.addEventListener('click', function () { openNoteInEditor(note); });

  return item;
}

function extractPreview(content) {
  var lines = content.split('\n').filter(function (l) { return l.trim(); });
  var title = (lines[0] || 'Untitled')
    .replace(/^#+\s*/, '')
    .replace(/^\*+|_+|~~|`/g, '')
    .trim();
  if (title.length > 70) title = title.substring(0, 70) + '...';

  var body = lines.slice(1, 4)
    .map(function (l) {
      return l.replace(/[#*_`>\-\[\]()~]/g, ' ').replace(/\s+/g, ' ').trim();
    })
    .join(' ')
    .substring(0, 120);

  return { title: title || 'Untitled', body: body };
}

function filterNotes() {
  if (!searchQuery) return allNotes;
  var q = searchQuery.toLowerCase();
  return allNotes.filter(function (n) {
    return n.content && n.content.toLowerCase().indexOf(q) !== -1;
  });
}

/* ── Delete ────────────────────────────────────────────────── */
function confirmDeleteNote() {
  if (!currentNoteName) return;

  var overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';

  var dialog = document.createElement('div');
  dialog.className = 'confirm-dialog';

  var h3 = document.createElement('h3');
  h3.textContent = 'Delete note?';

  var p = document.createElement('p');
  p.textContent = 'This will permanently delete this note from your Memos server.';

  var btns = document.createElement('div');
  btns.className = 'confirm-btns';

  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-ghost';
  cancelBtn.textContent = 'Cancel';

  var deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-danger';
  deleteBtn.textContent = 'Delete';

  btns.append(cancelBtn, deleteBtn);
  dialog.append(h3, p, btns);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  function close() { overlay.remove(); }
  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  deleteBtn.addEventListener('click', async function () {
    close();
    await deleteNote(currentNoteName);
  });
  function onKey(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
  }
  document.addEventListener('keydown', onKey);
}

async function deleteNote(name) {
  clearAutoSave();
  try {
    var res = await api('/api/v1/' + name, { method: 'DELETE' });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    allNotes = allNotes.filter(function (n) { return n.name !== name; });
    selectedNote = null;
    currentNoteName = null;
    hasUnsavedChanges = false;

    editorPane.classList.add('hidden');
    rightEmpty.classList.remove('hidden');

    renderNotesList();
    showToast('Note deleted.');
  } catch (err) {
    console.error('deleteNote:', err);
    showToast('Failed to delete note.', true);
  }
}

/* ── Event listeners ───────────────────────────────────────── */
btnNew.addEventListener('click', function () {
  if (hasUnsavedChanges && currentNoteName) {
    doAutoSave().then(openNewNote);
  } else {
    openNewNote();
  }
});

btnDeleteCurrent.addEventListener('click', confirmDeleteNote);

// Visibility change triggers save
noteVisibility.addEventListener('change', function () {
  if (currentNoteName) {
    hasUnsavedChanges = true;
    scheduleAutoSave();
  }
});

// Copy note link
function getMemoUrl() {
  if (!selectedNote) return null;
  // Try uid field first, then extract from name (e.g. "memos/abc123")
  var id = selectedNote.uid || (selectedNote.name ? selectedNote.name.replace(/^memos\//, '') : null);
  return id ? serverUrl + '/memos/' + id : null;
}

btnCopyLink.addEventListener('click', function () {
  var link = getMemoUrl();
  if (!link) {
    showToast('No note selected.', true);
    return;
  }
  navigator.clipboard.writeText(link).then(function () {
    showToast('Link copied!');
  }).catch(function () {
    showToast('Failed to copy link.', true);
  });
});

// Open in Memos
btnOpenMemos.addEventListener('click', function () {
  var link = getMemoUrl();
  window.open(link || serverUrl, '_blank');
});

tabPreview.addEventListener('click', function () {
  if (!isPreviewMode) enterPreviewMode();
});

tabEdit.addEventListener('click', function () {
  if (isPreviewMode) enterEditMode();
});

// Double-click preview to switch to edit
previewPane.addEventListener('dblclick', function () {
  enterEditMode();
});

searchInput.addEventListener('input', function () {
  searchQuery = searchInput.value.trim().toLowerCase();
  renderNotesList();
});

/* ── Keyboard shortcuts ────────────────────────────────────── */
document.addEventListener('keydown', function (e) {
  var ctrl = e.ctrlKey || e.metaKey;

  if (ctrl && e.key === 'k') {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
    return;
  }

  if (ctrl && e.key === 'n') {
    e.preventDefault();
    btnNew.click();
    return;
  }

  if (ctrl && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
    selectNextNote(e.key === 'ArrowDown' ? 1 : -1);
    return;
  }

  // Markdown toolbar shortcuts in textarea mode
  if (editorMode === 'markdown' && ctrl && document.activeElement === textEditor) {
    if (e.key === 'b') { e.preventDefault(); handleMarkdownCommand('bold'); }
    if (e.key === 'i') { e.preventDefault(); handleMarkdownCommand('italic'); }
    if (e.key === 'u') { e.preventDefault(); handleMarkdownCommand('underline'); }
    if (e.key === 'l') { e.preventDefault(); handleMarkdownCommand('link'); }
    if (e.key === '`') { e.preventDefault(); handleMarkdownCommand('code'); }
  }
});

function selectNextNote(direction) {
  var filtered = filterNotes();
  if (!filtered.length) return;

  var idx = selectedNote
    ? filtered.findIndex(function (n) { return n.name === selectedNote.name; })
    : -1;
  var next = Math.max(0, Math.min(filtered.length - 1, idx + direction));

  if (hasUnsavedChanges && currentNoteName) {
    doAutoSave().then(function () { openNoteInEditor(filtered[next]); });
  } else {
    openNoteInEditor(filtered[next]);
  }

  var el = notesList.querySelector('.note-item[data-name="' + CSS.escape(filtered[next].name) + '"]');
  if (el) el.scrollIntoView({ block: 'nearest' });
}

/* ── Settings ──────────────────────────────────────────────── */
btnSettings.addEventListener('click', function () {
  settingsOverlay.classList.remove('hidden');
});

btnCloseSettings.addEventListener('click', closeSettings);

settingsOverlay.addEventListener('click', function (e) {
  if (e.target === settingsOverlay) closeSettings();
});

function closeSettings() {
  settingsOverlay.classList.add('hidden');
}

settingTheme.addEventListener('change', function () {
  var theme = settingTheme.value;
  applyTheme(theme);
  chrome.storage.local.set({ theme: theme });
});

settingEditor.addEventListener('change', function () {
  switchEditorMode(settingEditor.value);
});

settingDisplay.addEventListener('change', function () {
  var mode = settingDisplay.value;
  chrome.storage.local.set({ displayMode: mode });
  showToast(mode === 'popup'
    ? 'Popup mode. Close and reopen the extension.'
    : 'Window mode. Close and click the icon again.');
});

/* ── Helpers ───────────────────────────────────────────────── */
function formatDate(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  var now = new Date();
  var diff = (now - d) / 1000;

  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';

  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function showToast(msg, isError) {
  notesError.textContent = msg;
  notesError.className = 'toast' + (isError ? ' toast-error' : '');
  clearTimeout(notesError._timer);
  notesError._timer = setTimeout(function () { notesError.classList.add('hidden'); }, 3500);
}

function hideToast() {
  notesError.classList.add('hidden');
  clearTimeout(notesError._timer);
}
