import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from 'tiptap-markdown';

window.createMemosEditor = function (element, options) {
  var opts = options || {};

  var extensions = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: true,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      },
    }),
    Placeholder.configure({
      placeholder: opts.placeholder || 'Start writing...',
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Markdown.configure({
      html: false,
      transformPastedText: true,
      transformCopiedText: true,
    }),
  ];

  try {
    var editor = new Editor({
      element: element,
      extensions: extensions,
      content: opts.content || '',
      editable: opts.editable !== false,
      onUpdate: function (ctx) {
        if (opts.onUpdate) opts.onUpdate(ctx);
      },
      onFocus: function (ctx) {
        if (opts.onFocus) opts.onFocus(ctx);
      },
      onBlur: function (ctx) {
        if (opts.onBlur) opts.onBlur(ctx);
      },
    });
  } catch (err) {
    console.error('TipTap Editor init error:', err);
    throw err;
  }

  return {
    editor: editor,

    getMarkdown: function () {
      return editor.storage.markdown.getMarkdown();
    },

    setMarkdown: function (md) {
      editor.commands.setContent(md || '');
    },

    destroy: function () {
      editor.destroy();
    },

    focus: function () {
      editor.commands.focus();
    },

    isEmpty: function () {
      return editor.isEmpty;
    },

    setEditable: function (val) {
      editor.setEditable(val);
    },

    toggleBold: function () { editor.chain().focus().toggleBold().run(); },
    toggleItalic: function () { editor.chain().focus().toggleItalic().run(); },
    toggleUnderline: function () { editor.chain().focus().toggleUnderline().run(); },
    toggleStrike: function () { editor.chain().focus().toggleStrike().run(); },
    toggleCode: function () { editor.chain().focus().toggleCode().run(); },
    toggleCodeBlock: function () { editor.chain().focus().toggleCodeBlock().run(); },
    toggleBulletList: function () { editor.chain().focus().toggleBulletList().run(); },
    toggleOrderedList: function () { editor.chain().focus().toggleOrderedList().run(); },
    toggleTaskList: function () { editor.chain().focus().toggleTaskList().run(); },
    toggleBlockquote: function () { editor.chain().focus().toggleBlockquote().run(); },
    toggleHeading: function (level) { editor.chain().focus().toggleHeading({ level: level }).run(); },
    setHorizontalRule: function () { editor.chain().focus().setHorizontalRule().run(); },
    setLink: function (url) {
      if (url) {
        editor.chain().focus().setLink({ href: url }).run();
      } else {
        editor.chain().focus().unsetLink().run();
      }
    },

    isActive: function (name, attrs) {
      return editor.isActive(name, attrs);
    },

    undo: function () { editor.chain().focus().undo().run(); },
    redo: function () { editor.chain().focus().redo().run(); },
  };
};
