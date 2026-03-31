/** @jsx jsx */
import { jsx, css } from '@emotion/core';
import { Builder } from '@builder.io/react';
import React, { useEffect, useRef, useState } from 'react';
import Quill from 'quill';
import QuillBetterTable from 'quill-better-table';
import { html as beautifyHtml } from 'js-beautify';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { html as htmlLang } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { basicSetup } from 'codemirror';
import 'quill/dist/quill.snow.css';
import 'quill/dist/quill.bubble.css';
import 'quill-better-table/dist/quill-better-table.css';

// Register the table module
Quill.register('modules/better-table', QuillBetterTable);

// Register spacer blot -- a visible empty space element
const BlockEmbed = Quill.import('blots/block/embed');
class SpacerBlot extends BlockEmbed {
  static create() {
    const node = super.create();
    node.setAttribute('data-spacer', 'true');
    node.innerHTML = '&nbsp;';
    return node;
  }
  static value(node) {
    return true;
  }
}
SpacerBlot.blotName = 'spacer';
SpacerBlot.tagName = 'div';
SpacerBlot.className = 'bq-spacer';
Quill.register(SpacerBlot);

// Register font size as a whitelist
const SizeStyle = Quill.import('attributors/style/size');
SizeStyle.whitelist = [
  '10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px', '64px', '72px'
];
Quill.register(SizeStyle, true);

function sanitizeHtml(html) {
  if (!html) return html;
  // Remove empty paragraphs (Quill generates these on Enter)
  let cleaned = html.replace(/<p>\s*<br\s*\/?>\s*<\/p>/gi, '');
  cleaned = cleaned.replace(/<p>\s*<\/p>/gi, '');
  // Collapse 3+ consecutive <br> into two
  cleaned = cleaned.replace(/(<br\s*\/?>){3,}/gi, '<br><br>');
  // Trim trailing <br>
  cleaned = cleaned.replace(/(<br\s*\/?>)+\s*$/gi, '');
  return cleaned;
}

function RichTextEditor(props) {
  const editorRef = useRef(null);
  const quillRef = useRef(null);
  const containerRef = useRef(null);
  const codeEditorRef = useRef(null);
  const codeMirrorRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCodeView, setIsCodeView] = useState(false);
  const [imageModal, setImageModal] = useState(null);
  const [tableGrid, setTableGrid] = useState(null);
  const [tableHover, setTableHover] = useState({ row: 0, col: 0 });
  const [activeTable, setActiveTable] = useState(null);
  const [linkModal, setLinkModal] = useState(null);
  const [videoModal, setVideoModal] = useState(null);
  const [colorModal, setColorModal] = useState(null);
  const lastFocusedCellRef = useRef(null);

  useEffect(() => {
    if (!editorRef.current || quillRef.current) return;

    const toolbarOptions = [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'size': SizeStyle.whitelist }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'list': 'check' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'align': [] }],
      ['blockquote', 'code-block'],
      ['link', 'image', 'video'],
      ['clean'],
      ['spacer']
    ];

    const quill = new Quill(editorRef.current, {
      theme: 'snow',
      modules: {
        toolbar: toolbarOptions,
        'better-table': {
          operationMenu: {
            items: {
              unmergeCells: { text: 'Unmerge cells' },
              insertColumnRight: { text: 'Insert column right' },
              insertColumnLeft: { text: 'Insert column left' },
              insertRowUp: { text: 'Insert row up' },
              insertRowDown: { text: 'Insert row down' },
              mergeCells: { text: 'Merge selected cells' },
              deleteColumn: { text: 'Delete column' },
              deleteRow: { text: 'Delete row' },
              deleteTable: { text: 'Delete table' }
            }
          }
        },
        keyboard: {
          bindings: QuillBetterTable.keyboardBindings
        }
      }
    });

    const toolbar = quill.getModule('toolbar');

    // Spacer handler
    toolbar.addHandler('spacer', function() {
      const range = quill.getSelection(true);
      if (range) {
        quill.insertEmbed(range.index, 'spacer', true, 'user');
        quill.setSelection(range.index + 1);
      }
    });

    // Custom image handler -- modal with URL input or file upload
    toolbar.addHandler('image', function() {
      const range = quill.getSelection(true);
      setImageModal({
        element: null,
        alt: '',
        width: '',
        height: '',
        src: '',
        range: range,
        isNew: true
      });
    });

    // Custom link handler -- use our modal instead of Quill's tooltip
    toolbar.addHandler('link', function() {
      const range = quill.getSelection();
      if (!range) return;
      const selectedText = quill.getText(range.index, range.length);
      const format = quill.getFormat(range);
      setLinkModal({
        element: null,
        url: format.link || '',
        text: selectedText || '',
        target: '_blank',
        range: range
      });
    });

    // Custom video handler -- use our modal
    toolbar.addHandler('video', function() {
      const range = quill.getSelection();
      setVideoModal({ url: '', range: range });
    });

    if (props.value) {
      quill.root.innerHTML = props.value;
    }

    quill.on('text-change', () => {
      if (props.onChange) {
        props.onChange(sanitizeHtml(quill.root.innerHTML));
      }
    });

    // Update size picker label based on selection
    const headerSizeMap = { 1: '32px', 2: '24px', 3: '20px', 4: '18px', 5: '16px', 6: '14px' };
    const updateSizeLabel = () => {
      const sizeLabel = containerRef.current?.querySelector('.ql-picker.ql-size .ql-picker-label');
      if (!sizeLabel) return;
      const range = quill.getSelection();
      if (!range) return;
      const format = quill.getFormat(range);
      let sizeText = '14px';
      if (format.size) {
        sizeText = format.size;
      } else if (format.header) {
        sizeText = headerSizeMap[format.header] || '14px';
      }
      // Check for mixed sizes in selection
      if (range.length > 0) {
        const lines = quill.getContents(range.index, range.length);
        const sizes = new Set();
        lines.ops.forEach(op => {
          if (op.attributes && op.attributes.size) {
            sizes.add(op.attributes.size);
          } else if (op.attributes && op.attributes.header) {
            sizes.add(headerSizeMap[op.attributes.header] || '14px');
          } else if (typeof op.insert === 'string' && op.insert.trim()) {
            sizes.add(format.header ? headerSizeMap[format.header] || '14px' : format.size || '14px');
          }
        });
        if (sizes.size > 1) {
          sizeText = 'Mixed';
        }
      }
      sizeLabel.setAttribute('data-value', sizeText);
    };
    quill.on('selection-change', updateSizeLabel);
    quill.on('text-change', updateSizeLabel);

    quillRef.current = quill;

    const toolbarElement = containerRef.current.querySelector('.ql-toolbar');
    if (toolbarElement) {


      // Add table button with grid picker
      const tableButton = document.createElement('button');
      tableButton.innerHTML = '<svg viewBox="0 0 18 18" width="18" height="18"><rect x="1" y="1" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="1" y1="7" x2="17" y2="7" stroke="currentColor" stroke-width="1.5"/><line x1="1" y1="12" x2="17" y2="12" stroke="currentColor" stroke-width="1.5"/><line x1="7" y1="1" x2="7" y2="17" stroke="currentColor" stroke-width="1.5"/><line x1="12" y1="1" x2="12" y2="17" stroke="currentColor" stroke-width="1.5"/></svg>';
      tableButton.className = 'bq-table-btn';
      tableButton.title = 'Insert Table';
      tableButton.type = 'button';
      tableButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = tableButton.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        setTableGrid((prev) => prev ? null : {
          top: rect.bottom - containerRect.top,
          left: rect.left - containerRect.left
        });
      });
      toolbarElement.appendChild(tableButton);

      // Style the spacer button with text label
      const spacerBtn = toolbarElement.querySelector('.ql-spacer');
      if (spacerBtn) {
        spacerBtn.innerHTML = 'Empty Space';
        spacerBtn.className = 'ql-spacer bq-spacer-btn';
        spacerBtn.title = 'Insert Empty Space';
      }

      // Intercept color picker clicks to open our modal
      const colorPicker = toolbarElement.querySelector('.ql-picker.ql-color');
      const bgPicker = toolbarElement.querySelector('.ql-picker.ql-background');

      const openColorModal = (type) => {
        const range = quill.getSelection(true);
        const format = quill.getFormat(range);
        const current = type === 'color' ? (format.color || '') : (format.background || '');
        setColorModal({ type, current, range });
      };

      if (colorPicker) {
        const colorLabel = colorPicker.querySelector('.ql-picker-label');
        if (colorLabel) {
          colorLabel.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            colorPicker.classList.remove('ql-expanded');
            openColorModal('color');
          }, true);
        }
      }

      if (bgPicker) {
        const bgLabel = bgPicker.querySelector('.ql-picker-label');
        if (bgLabel) {
          bgLabel.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            bgPicker.classList.remove('ql-expanded');
            openColorModal('background');
          }, true);
        }
      }
    }

    // Update color icons to reflect current text formatting
    const updateColorIcons = () => {
      if (!containerRef.current) return;
      const range = quill.getSelection();
      if (!range) return;
      const format = quill.getFormat(range);

      // Text color indicator
      const colorPicker = containerRef.current.querySelector('.ql-picker.ql-color');
      if (colorPicker) {
        const label = colorPicker.querySelector('.ql-picker-label');
        const colorLabels = colorPicker.querySelectorAll('.ql-color-label');
        const c = format.color || '';
        colorLabels.forEach(el => {
          el.style.fill = c || '#a0a0a0';
          el.style.stroke = c || '#a0a0a0';
        });
        // Also set a bottom border on the label as a visible indicator
        if (label) {
          label.style.borderBottom = c ? '3px solid ' + c : '3px solid #a0a0a0';
          label.style.paddingBottom = '1px';
        }
      }

      // Background color indicator
      const bgPicker = containerRef.current.querySelector('.ql-picker.ql-background');
      if (bgPicker) {
        const label = bgPicker.querySelector('.ql-picker-label');
        const bgLabels = bgPicker.querySelectorAll('.ql-color-label');
        const bg = format.background || '';
        bgLabels.forEach(el => {
          el.style.fill = bg || '#a0a0a0';
          el.style.stroke = bg || '#a0a0a0';
        });
        if (label) {
          label.style.borderBottom = bg ? '3px solid ' + bg : '3px solid #a0a0a0';
          label.style.paddingBottom = '1px';
        }
      }
    };
    quill.on('selection-change', updateColorIcons);
    quill.on('text-change', updateColorIcons);
    // Run once on init
    setTimeout(updateColorIcons, 200);

    // Aggressively kill any DOM elements quill-better-table injects
    const nukeTableUI = () => {
      if (!containerRef.current) return;
      containerRef.current.querySelectorAll('[class*="qlbt"]').forEach(el => el.remove());
      containerRef.current.querySelectorAll('.ql-table, .ql-picker.ql-table').forEach(el => {
        if (!el.classList.contains('bq-table-btn')) el.remove();
      });
      // Kill any element in the toolbar that isn't ours and looks like a table picker
      if (toolbarElement) {
        toolbarElement.querySelectorAll('select, [class*="table"]:not(.bq-table-btn)').forEach(el => el.remove());
      }
    };
    nukeTableUI();
    setTimeout(nukeTableUI, 50);
    setTimeout(nukeTableUI, 200);
    setTimeout(nukeTableUI, 500);
    setTimeout(nukeTableUI, 1000);
    setTimeout(nukeTableUI, 2000);

    // Watch the toolbar forever -- kill anything quill-better-table adds
    const toolbarObserver = new MutationObserver(() => nukeTableUI());
    if (toolbarElement) {
      toolbarObserver.observe(toolbarElement, { childList: true, subtree: true });
    }

    // Delete table on Backspace/Delete when cursor is inside empty table cell
    quill.root.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const td = e.target.closest ? e.target.closest('td') : null;
        if (!td) return;
        const table = td.closest('table');
        if (!table) return;
        // Check if entire table is empty
        const cells = table.querySelectorAll('td');
        const allEmpty = Array.from(cells).every(c => !c.textContent.trim());
        if (allEmpty) {
          e.preventDefault();
          table.closest('.quill-better-table-wrapper')?.remove() || table.remove();
          if (props.onChange) {
            props.onChange(sanitizeHtml(quill.root.innerHTML));
          }
        }
      }
    });

    // Permanently kill Quill's built-in tooltip
    const killTooltip = () => {
      const tooltip = containerRef.current?.querySelector('.ql-tooltip');
      if (tooltip) {
        tooltip.style.display = 'none';
        tooltip.style.position = 'absolute';
        tooltip.style.left = '-9999px';
      }
    };
    killTooltip();
    setTimeout(killTooltip, 100);
    setTimeout(killTooltip, 500);

    // Observe DOM to kill tooltip whenever Quill tries to show it
    const observer = new MutationObserver(killTooltip);
    const qlContainer = containerRef.current?.querySelector('.ql-container');
    if (qlContainer) {
      observer.observe(qlContainer, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    }

    // Close things on Escape
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setActiveTable(null);
        setLinkModal(null);
        setVideoModal(null);
        setColorModal(null);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Image, link, and table click handler
    quill.root.addEventListener('click', (e) => {
      // Prevent default link navigation in editor
      const link = e.target.closest('a');
      if (link) {
        e.preventDefault();
        killTooltip();
        setLinkModal({
          element: link,
          url: link.getAttribute('href') || '',
          text: link.textContent || '',
          target: link.getAttribute('target') || ''
        });
        setActiveTable(null);
        return;
      }

      const img = e.target.closest('img');
      if (img) {
        setImageModal({
          element: img,
          alt: img.getAttribute('alt') || '',
          width: img.getAttribute('width') || '',
          height: img.getAttribute('height') || '',
          src: img.getAttribute('src') || ''
        });
        setActiveTable(null);
        return;
      }

      const td = e.target.closest('td, th');
      if (td) {
        lastFocusedCellRef.current = td;
        const table = td.closest('table');
        const wrapper = td.closest('.quill-better-table-wrapper') || table;
        if (wrapper) {
          const wrapperRect = wrapper.getBoundingClientRect();
          const containerRect = containerRef.current.getBoundingClientRect();
          const scrollTop = quill.root.closest('.ql-container')?.scrollTop || 0;
          setActiveTable({
            element: wrapper,
            top: wrapperRect.top - containerRect.top + scrollTop - 32,
            right: containerRect.right - wrapperRect.right
          });
        }
      } else {
        setActiveTable(null);
      }
    });

    return () => {
      document.removeEventListener('keydown', handleEscape);
      observer.disconnect();
      toolbarObserver.disconnect();
      if (quillRef.current) {
        quillRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (quillRef.current && props.value !== undefined) {
      const currentContent = quillRef.current.root.innerHTML;
      if (currentContent !== props.value && !isCodeView) {
        quillRef.current.root.innerHTML = props.value;
      }
    }
  }, [props.value]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const insertTable = (rows, cols) => {
    if (quillRef.current) {
      const tableModule = quillRef.current.getModule('better-table');
      tableModule.insertTable(rows, cols);
    }
    setTableGrid(null);
    setTableHover({ row: 0, col: 0 });
  };

  const saveLinkProps = () => {
    if (!linkModal) return;
    if (linkModal.element) {
      // Editing existing link
      const link = linkModal.element;
      link.setAttribute('href', linkModal.url || '#');
      if (linkModal.text && linkModal.text !== link.textContent) {
        link.textContent = linkModal.text;
      }
      if (linkModal.target) {
        link.setAttribute('target', linkModal.target);
      } else {
        link.removeAttribute('target');
      }
    } else if (linkModal.range && quillRef.current) {
      // Creating new link from toolbar
      const quill = quillRef.current;
      if (linkModal.range.length > 0) {
        quill.formatText(linkModal.range.index, linkModal.range.length, 'link', linkModal.url);
      } else if (linkModal.text) {
        quill.insertText(linkModal.range.index, linkModal.text, 'link', linkModal.url);
      }
    }
    if (props.onChange && quillRef.current) {
      props.onChange(sanitizeHtml(quillRef.current.root.innerHTML));
    }
    setLinkModal(null);
  };

  const removeLink = () => {
    if (!linkModal) return;
    if (linkModal.element) {
      const link = linkModal.element;
      const text = document.createTextNode(link.textContent);
      link.parentNode.replaceChild(text, link);
    } else if (linkModal.range && quillRef.current) {
      quillRef.current.formatText(linkModal.range.index, linkModal.range.length, 'link', false);
    }
    if (props.onChange && quillRef.current) {
      props.onChange(sanitizeHtml(quillRef.current.root.innerHTML));
    }
    setLinkModal(null);
  };

  const insertVideo = () => {
    if (!videoModal || !videoModal.url || !quillRef.current) {
      setVideoModal(null);
      return;
    }
    const range = videoModal.range || quillRef.current.getSelection() || { index: quillRef.current.getLength() };
    quillRef.current.insertEmbed(range.index, 'video', videoModal.url);
    if (props.onChange) {
      props.onChange(sanitizeHtml(quillRef.current.root.innerHTML));
    }
    setVideoModal(null);
  };

  const applyColor = (color, keepOpen) => {
    if (!colorModal || !quillRef.current) return;
    quillRef.current.setSelection(colorModal.range);
    if (color === null) {
      quillRef.current.format(colorModal.type, false);
    } else {
      quillRef.current.format(colorModal.type, color);
    }
    if (props.onChange) {
      props.onChange(sanitizeHtml(quillRef.current.root.innerHTML));
    }
    if (!keepOpen) {
      setColorModal(null);
    }
  };

  const colorSwatches = [
    '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
    '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
    '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
    '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
    '#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0',
    '#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79',
    '#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47',
    '#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130',
  ];

  const deleteActiveTable = () => {
    if (!activeTable || !activeTable.element) return;
    activeTable.element.remove();
    setActiveTable(null);
    if (props.onChange && quillRef.current) {
      props.onChange(sanitizeHtml(quillRef.current.root.innerHTML));
    }
  };

  const tableAction = (action) => {
    if (!quillRef.current || !activeTable) return;
    const table = activeTable.element.querySelector('table') || activeTable.element;
    if (!table) return;

    // Use the stored cell reference from the last click
    const focusedCell = lastFocusedCellRef.current;
    const focusedRow = focusedCell?.closest('tr');
    // Fallback: if no focused cell, use last row
    const fallbackRow = table.querySelector('tr:last-child');

    try {
      switch(action) {
        case 'insertRowAbove':
        case 'insertRowBelow': {
          const refRow = focusedRow || fallbackRow;
          if (!refRow) break;
          const colCount = refRow.cells.length;
          const newRow = document.createElement('tr');
          for (let i = 0; i < colCount; i++) {
            const td = document.createElement('td');
            td.innerHTML = '<p><br></p>';
            // Copy width from reference cell if set
            const refCell = refRow.cells[i];
            if (refCell && refCell.style.width) {
              td.style.width = refCell.style.width;
            }
            newRow.appendChild(td);
          }
          if (action === 'insertRowAbove') {
            refRow.parentNode.insertBefore(newRow, refRow);
          } else {
            refRow.parentNode.insertBefore(newRow, refRow.nextSibling);
          }
          break;
        }
        case 'insertColLeft':
        case 'insertColRight': {
          const colIndex = focusedCell ? focusedCell.cellIndex : 0;
          Array.from(table.querySelectorAll('tr')).forEach(row => {
            const refCell = row.cells[colIndex];
            if (!refCell) return;
            const newCell = document.createElement('td');
            newCell.innerHTML = '<p><br></p>';
            if (action === 'insertColLeft') {
              row.insertBefore(newCell, refCell);
            } else {
              row.insertBefore(newCell, refCell.nextSibling);
            }
          });
          break;
        }
        case 'deleteRow': {
          if (!focusedRow) break;
          const rows = table.querySelectorAll('tr');
          if (rows.length <= 1) {
            deleteActiveTable();
            return;
          }
          focusedRow.remove();
          break;
        }
        case 'deleteCol': {
          if (!focusedCell) break;
          const colIdx = focusedCell.cellIndex;
          const allRows = table.querySelectorAll('tr');
          const totalCols = allRows[0]?.cells.length || 0;
          if (totalCols <= 1) {
            deleteActiveTable();
            return;
          }
          allRows.forEach(row => {
            if (row.cells[colIdx]) row.cells[colIdx].remove();
          });
          break;
        }
      }
      if (props.onChange && quillRef.current) {
        props.onChange(sanitizeHtml(quillRef.current.root.innerHTML));
      }
    } catch(e) { console.error('Table action error:', e); }
  };


  const saveImageProps = () => {
    if (!imageModal) return;

    if (imageModal.isNew && imageModal.src && quillRef.current) {
      // Insert new image
      const range = imageModal.range || quillRef.current.getSelection() || { index: quillRef.current.getLength() };
      quillRef.current.insertEmbed(range.index, 'image', imageModal.src);
      // Set alt text after insert
      if (imageModal.alt) {
        setTimeout(() => {
          const imgs = quillRef.current.root.querySelectorAll('img[src="' + imageModal.src + '"]');
          const newImg = imgs[imgs.length - 1];
          if (newImg) {
            newImg.setAttribute('alt', imageModal.alt);
            if (imageModal.width) newImg.setAttribute('width', imageModal.width);
            if (imageModal.height) newImg.setAttribute('height', imageModal.height);
          }
        }, 50);
      }
    } else if (imageModal.element) {
      // Edit existing image
      const img = imageModal.element;
      if (imageModal.src && imageModal.src !== img.getAttribute('src')) {
        img.setAttribute('src', imageModal.src);
      }
      img.setAttribute('alt', imageModal.alt || '');
      if (imageModal.width) {
        img.setAttribute('width', imageModal.width);
      } else {
        img.removeAttribute('width');
      }
      if (imageModal.height) {
        img.setAttribute('height', imageModal.height);
      } else {
        img.removeAttribute('height');
      }
    }
    if (props.onChange && quillRef.current) {
      props.onChange(sanitizeHtml(quillRef.current.root.innerHTML));
    }
    setImageModal(null);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageModal(prev => ({ ...prev, src: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const deleteImage = () => {
    if (!imageModal || !imageModal.element) return;
    imageModal.element.remove();
    if (props.onChange && quillRef.current) {
      props.onChange(sanitizeHtml(quillRef.current.root.innerHTML));
    }
    setImageModal(null);
  };

  const toggleCodeView = () => {
    if (isCodeView) {
      if (quillRef.current && codeMirrorRef.current) {
        try {
          const newHtml = codeMirrorRef.current.state.doc.toString();
          quillRef.current.root.innerHTML = newHtml;
          if (props.onChange) {
            props.onChange(sanitizeHtml(newHtml));
          }
        } catch (error) {
          console.error('Error updating editor:', error);
        }
      }
      setIsCodeView(false);
    } else {
      if (quillRef.current && codeEditorRef.current) {
        try {
          const rawHtml = quillRef.current.root.innerHTML;
          const formattedHtml = beautifyHtml(rawHtml, {
            indent_size: 2,
            indent_char: ' ',
            max_preserve_newlines: 1,
            preserve_newlines: true,
            end_with_newline: false,
            wrap_line_length: 0,
            indent_inner_html: true,
            unformatted: [],
            content_unformatted: ['pre', 'textarea']
          });

          if (!codeMirrorRef.current) {
            const extensions = [
              basicSetup,
              htmlLang(),
              keymap.of([indentWithTab]),
              EditorView.lineWrapping,
              oneDark
            ];

            codeMirrorRef.current = new EditorView({
              state: EditorState.create({
                doc: formattedHtml,
                extensions: extensions
              }),
              parent: codeEditorRef.current
            });
          } else {
            codeMirrorRef.current.dispatch({
              changes: {
                from: 0,
                to: codeMirrorRef.current.state.doc.length,
                insert: formattedHtml
              }
            });
          }

          setIsCodeView(true);
        } catch (error) {
          console.error('Error formatting HTML:', error);
        }
      }
    }
  };

  useEffect(() => {
    return () => {
      if (codeMirrorRef.current) {
        codeMirrorRef.current.destroy();
        codeMirrorRef.current = null;
      }
    };
  }, []);

  // -- Brutalist / Editorial Design --
  const containerStyles = css`
    position: ${isFullscreen ? 'fixed' : 'relative'};
    top: ${isFullscreen ? '0' : 'auto'};
    left: ${isFullscreen ? '0' : 'auto'};
    width: ${isFullscreen ? '100vw' : '100%'};
    height: ${isFullscreen ? '100svh' : 'auto'};
    z-index: ${isFullscreen ? '99999' : 'auto'};
    background: #191919;
    color: #e0e0e0;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ${isFullscreen ? 'padding: 0; margin: 0;' : ''}
    border: 1px solid #333333;

    /* -- Control Bar -- */
    .control-bar {
      display: flex;
      gap: 0;
      padding: 0;
      background: #1a1a1a;
      border-bottom: 1px solid #333333;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .control-button {
      padding: 8px 16px;
      border: none;
      border-right: 1px solid #333333;
      background: #1a1a1a;
      color: #a0a0a0;
      cursor: pointer;
      font-size: 11px;
      font-weight: 400;
      letter-spacing: 1px;
      text-transform: uppercase;
      font-family: 'Courier New', monospace;
      transition: none;

      &:hover {
        background: #e0e0e0;
        color: #191919;
      }

      &.active {
        background: #e0e0e0;
        color: #191919;
      }
    }


    /* -- Editor Wrapper -- */
    .editor-wrapper {
      ${isCodeView ? 'display: none;' : ''}
      ${isFullscreen ? `
        flex: 1;
        overflow: auto;
      ` : ''}

      > div {
        width: 100%;
      }
    }

    /* -- Code Editor -- */
    .code-editor {
      ${isFullscreen ? 'flex: 1; padding: 0;' : 'height: 400px;'}
      display: ${isCodeView ? 'block' : 'none'};
      margin: 0;
      width: 100%;
      box-sizing: border-box;
      overflow: auto;
      background: #111111;

      .cm-editor {
        height: ${isFullscreen ? 'calc(100svh - 80px)' : '400px'};
        font-size: 13px;
        font-family: 'Courier New', monospace;
        border: none;
        background: #111111;

        .cm-scroller {
          overflow: auto;
          height: 100%;
        }

        .cm-gutters {
          background: #1a1a1a;
          border-right: 1px solid #333333;
          color: #666666;
        }

        .cm-activeLineGutter {
          background: #2a2a2a;
        }

        .cm-activeLine {
          background: rgba(255, 255, 255, 0.03);
        }
      }
    }

    /* -- Scrollbar -- */
    .ql-container {
      ${isFullscreen ? `
        background: #111111;
        overflow: visible !important;
        height: auto !important;
      ` : 'height: 400px; overflow-y: auto;'}
      font-size: 14px;

      &::-webkit-scrollbar {
        width: 14px;
      }

      &::-webkit-scrollbar-track {
        background: ${isFullscreen ? '#111111' : '#191919'};
        border-left: 1px solid #333333;
      }

      &::-webkit-scrollbar-thumb {
        background: #2a2a2a;
        border: 1px solid #333333;
      }

      &::-webkit-scrollbar-thumb:hover {
        background: #3a3a3a;
      }
    }

    /* -- Quill Editor Content -- */
    .ql-editor {
      ${isFullscreen ? `
        max-width: 850px;
        width: 100%;
        margin: 40px auto;
        background: #191919;
        min-height: calc(100svh - 200px);
        padding: 60px 80px;
        border: 1px solid #333333;
        box-sizing: border-box;
        box-shadow: 0 2px 20px rgba(0, 0, 0, 0.4);
      ` : `
        min-height: 100%;
        background: #191919;
        padding: 24px 32px;
      `}
      color: #e0e0e0;
      font-size: 15px;
      line-height: 1.6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

      &:focus {
        outline: none;
      }

      > * { margin-top: 0; margin-bottom: 0; }
      > * + * { margin-top: 8px; }
      > p:empty, > p > br:only-child { margin: 0; line-height: 1.2; }
      p { margin: 0; padding: 0; }
      p + p { margin-top: 6px; }

      h1, h2, h3, h4, h5, h6 {
        margin-top: 20px;
        margin-bottom: 4px;
        font-weight: 400;
        color: #e0e0e0 !important;
        line-height: 1.2;
      }

      h1 { font-size: 32px; }
      h2 { font-size: 24px; }
      h3 { font-size: 20px; }

      ul, ol {
        padding-left: 24px;
        margin-top: 4px;
        margin-bottom: 4px;
      }

      li { margin-bottom: 2px; }

      blockquote {
        border-left: 3px solid #333333;
        padding-left: 16px;
        margin-left: 0;
        margin-top: 8px;
        margin-bottom: 8px;
        color: #a0a0a0;
      }

      code {
        background-color: #2a2a2a !important;
        padding: 2px 6px !important;
        font-family: 'Courier New', monospace;
        font-size: 0.9em;
        color: inherit;
        border-radius: 0 !important;
      }

      code:not([style*="color"]) {
        color: #e0e0e0;
      }

      pre {
        background: #1a1a1a;
        border: 1px solid #333333;
        padding: 16px;
        overflow-x: auto;
        font-family: 'Courier New', monospace;
      }

      a {
        color: #79c0ff;
        text-decoration: underline;
        text-underline-offset: 2px;
      }

      img, video {
        max-width: 100%;
        height: auto;
        margin: 8px 0;
      }

      img {
        cursor: pointer;

        &:hover {
          outline: 2px solid #e0e0e0;
          outline-offset: 2px;
        }
      }
    }

    /* -- Toolbar -- */
    .ql-toolbar {
      background: #1a1a1a;
      border: none !important;
      border-bottom: 1px solid #333333 !important;
      padding: 6px 8px;
      display: flex !important;
      flex-direction: row !important;
      flex-wrap: wrap !important;
      gap: 0;
      align-items: center;
      width: 100% !important;
      box-sizing: border-box;
      position: sticky;
      top: 0px;
      z-index: 99;
    }

    .ql-toolbar .ql-formats {
      margin-right: 0px !important;
      display: inline-flex !important;
      flex-direction: row !important;
      gap: 0;
      align-items: center;
      padding: 0 4px;
      border-right: 1px solid #333333;
    }

    .ql-toolbar .ql-formats:last-child {
      border-right: none;
    }

    .ql-toolbar button {
      width: 28px !important;
      height: 28px !important;
      padding: 4px !important;
      border: none;
      background: transparent;
      cursor: pointer;
      transition: none;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }

    .ql-toolbar button svg {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .ql-toolbar .ql-stroke {
      stroke: #a0a0a0;
      stroke-width: 2;
    }

    .ql-toolbar .ql-fill {
      fill: #a0a0a0;
    }

    .ql-toolbar .ql-picker {
      height: 28px;
    }

    .ql-toolbar .ql-picker-label {
      color: #a0a0a0;
      padding: 4px 8px;
      border: none;
      font-size: 12px;
      display: flex !important;
      align-items: center !important;
    }

    .ql-toolbar .ql-picker-label:hover {
      background: #2a2a2a;
    }

    .ql-toolbar button:hover {
      background: #2a2a2a;
    }

    .ql-toolbar button:hover .ql-stroke {
      stroke: #e0e0e0;
    }

    .ql-toolbar button:hover .ql-fill {
      fill: #e0e0e0;
    }

    .ql-toolbar button.ql-active {
      background: #e0e0e0;
    }

    .ql-toolbar button.ql-active .ql-stroke {
      stroke: #191919;
    }

    .ql-toolbar button.ql-active .ql-fill {
      fill: #191919;
    }

    .ql-toolbar .ql-picker-label.ql-active {
      background: #2a2a2a;
      color: #e0e0e0;
    }

    .ql-toolbar .ql-picker-label.ql-active .ql-stroke {
      stroke: #e0e0e0;
    }

    .ql-toolbar .ql-picker.ql-expanded .ql-picker-label {
      background: #2a2a2a;
      color: #e0e0e0;
    }

    .ql-container.ql-snow {
      border: none;
      ${isFullscreen ? 'display: flex; flex-direction: column; flex: 1;' : ''}
    }

    ${isFullscreen ? `
    .ql-toolbar.ql-snow {
      width: 100%;
      box-sizing: border-box;
    }
    ` : ''}

    /* -- Picker Dropdown -- */
    .ql-picker-options {
      background: #1a1a1a !important;
      border: 1px solid #333333;
      padding: 0;
      box-shadow: none;
      margin-top: 0;
    }

    .ql-snow .ql-picker.ql-expanded .ql-picker-options {
      background: #1a1a1a !important;
      border: 1px solid #333333 !important;
    }

    /* Non-color picker items (header, size, align) */
    .ql-picker:not(.ql-color-picker) .ql-picker-item {
      color: #a0a0a0 !important;
      padding: 6px 10px;
    }

    .ql-picker:not(.ql-color-picker) .ql-picker-item:hover {
      background: #2a2a2a !important;
      color: #e0e0e0 !important;
    }

    .ql-picker:not(.ql-color-picker) .ql-picker-options .ql-picker-item {
      color: #a0a0a0 !important;
      background: transparent !important;
    }

    .ql-picker:not(.ql-color-picker) .ql-picker-options .ql-picker-item:hover {
      background: #2a2a2a !important;
      color: #e0e0e0 !important;
    }

    /* Size picker label display */
    .ql-snow .ql-picker.ql-size .ql-picker-label::before {
      content: attr(data-value) !important;
      color: #a0a0a0;
    }
    .ql-snow .ql-picker.ql-size .ql-picker-item::before {
      content: attr(data-value);
    }
    .ql-snow .ql-picker.ql-size .ql-picker-item[data-value=""]::before {
      content: '14px (default)';
    }

    /* Text selection highlight */
    .ql-editor ::selection {
      background: rgba(100, 160, 255, 0.3);
      color: inherit;
    }
    .ql-editor ::-moz-selection {
      background: rgba(100, 160, 255, 0.3);
      color: inherit;
    }

    /* -- Table -- */
    .quill-better-table-wrapper {
      overflow-x: auto;
      margin: 12px 0;
      position: relative;
    }

    /* Hide ALL quill-better-table injected UI */
    .qlbt-col-tool,
    .qlbt-operation-menu,
    .quill-better-table-wrapper .qlbt-col-tool,
    .ql-editor .qlbt-col-tool,
    [class*="qlbt-"] {
      display: none !important;
      height: 0 !important;
      width: 0 !important;
      overflow: hidden !important;
      position: absolute !important;
      left: -9999px !important;
    }

    /* Also hide any stray table picker that quill-better-table injects in the toolbar */
    .ql-toolbar .ql-picker.ql-table-picker,
    .ql-toolbar [class*="table-picker"],
    .ql-toolbar .qlbt-operation-menu {
      display: none !important;
    }

    .ql-table,
    .bq-table-btn {
      padding: 4px 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #a0a0a0;
      background: transparent;
      border: none;
      cursor: pointer;
      width: 28px !important;
      height: 28px !important;
    }

    .bq-table-btn:hover {
      background: #2a2a2a;
    }

    /* Spacer button */
    .bq-spacer-btn {
      width: auto !important;
      height: 28px !important;
      padding: 4px 10px !important;
      font-size: 10px !important;
      font-family: 'Courier New', monospace !important;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #a0a0a0;
      background: transparent;
      border: none;
      cursor: pointer;
      white-space: nowrap;
    }

    .bq-spacer-btn:hover {
      background: #2a2a2a;
      color: #e0e0e0;
    }

    /* Spacer element in editor */
    .bq-spacer {
      display: block;
      height: 24px;
      min-height: 24px;
      border: 1px dashed #333333;
      background: rgba(255, 255, 255, 0.02);
      margin: 4px 0;
      position: relative;
      cursor: pointer;
      user-select: all;
    }

    .bq-spacer::before {
      content: 'EMPTY SPACE';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 9px;
      font-family: 'Courier New', monospace;
      letter-spacing: 2px;
      color: #333333;
      pointer-events: none;
    }

    .bq-spacer:hover {
      border-color: #666666;
      background: rgba(255, 255, 255, 0.04);
    }

    .bq-spacer:hover::before {
      color: #666666;
    }

    /* Table cell styling */
    .quill-better-table td,
    .ql-editor td,
    .ql-editor th {
      border: 1px solid #444444 !important;
      padding: 8px 12px !important;
      color: #e0e0e0 !important;
      background: transparent !important;
      min-width: 40px;
      position: relative;
    }

    .quill-better-table th,
    .ql-editor th {
      background: #2a2a2a !important;
      font-weight: 600;
    }

    .quill-better-table tr:hover td,
    .ql-editor tr:hover td {
      background: #1f1f1f !important;
    }

    .quill-better-table,
    .ql-editor table {
      border-collapse: collapse;
      width: 100%;
      border: 1px solid #444444;
      table-layout: auto;
    }

    /* Table floating toolbar */
    .table-toolbar {
      position: absolute;
      z-index: 50;
      display: flex;
      gap: 0;
      background: #1a1a1a;
      border: 1px solid #333333;
    }

    .table-toolbar-btn {
      padding: 5px 10px;
      border: none;
      border-right: 1px solid #333333;
      background: #1a1a1a;
      color: #a0a0a0;
      cursor: pointer;
      font-size: 10px;
      font-weight: 400;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      font-family: 'Courier New', monospace;
      transition: none;
      white-space: nowrap;
    }

    .table-toolbar-btn:last-child {
      border-right: none;
    }

    .table-toolbar-btn:hover {
      background: #e0e0e0;
      color: #191919;
    }

    .table-toolbar-btn.delete-btn {
      color: #ff4444;
    }

    .table-toolbar-btn.delete-btn:hover {
      background: #ff4444;
      color: #191919;
    }

    /* Column resize handle */
    .ql-editor td {
      resize: horizontal;
      overflow: auto;
    }

    /* Table grid picker */
    .table-grid-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 99998;
    }

    .table-grid-picker {
      position: absolute;
      z-index: 99999;
      background: #1a1a1a;
      border: 1px solid #333333;
      padding: 8px;
    }

    .table-grid-picker-label {
      font-size: 11px;
      font-family: 'Courier New', monospace;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #666666;
      padding: 0 0 6px 0;
      text-align: center;
    }

    .table-grid-rows {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .table-grid-row {
      display: flex;
      gap: 2px;
    }

    .table-grid-cell {
      width: 18px;
      height: 18px;
      border: 1px solid #333333;
      background: transparent;
      cursor: pointer;
      padding: 0;
      transition: none;
    }

    .table-grid-cell.active {
      background: #e0e0e0;
      border-color: #e0e0e0;
    }

    .table-grid-cell:hover {
      border-color: #666666;
    }

    /* -- Code Block -- */
    .ql-editor pre.ql-syntax {
      background-color: #1a1a1a;
      color: #abb2bf;
      overflow: visible;
      padding: 16px;
      margin: 8px 0;
      border: 1px solid #333333;
      font-family: 'Courier New', monospace;
    }

    /* -- Blockquote override -- */
    .ql-editor blockquote {
      border-left: 3px solid #333333;
      background: transparent;
      padding: 8px 20px;
      margin: 8px 0;
      color: #a0a0a0;
    }

    /* -- Image Modal -- */
    .image-modal-overlay {
      position: ${isFullscreen ? 'fixed' : 'absolute'};
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100000;
    }

    .image-modal {
      background: #1a1a1a;
      border: 1px solid #333333;
      width: 420px;
      max-width: 90%;
      max-height: 80vh;
      overflow-y: auto;
    }

    .image-modal-header {
      padding: 12px 16px;
      font-size: 11px;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #a0a0a0;
      border-bottom: 1px solid #333333;
      font-family: 'Courier New', monospace;
    }

    .image-modal-preview {
      padding: 16px;
      background: #191919;
      border-bottom: 1px solid #333333;
      display: flex;
      justify-content: center;

      img {
        max-width: 100%;
        max-height: 200px;
        object-fit: contain;
      }
    }

    .image-modal-field {
      padding: 8px 16px;
      flex: 1;

      label {
        display: block;
        font-size: 11px;
        font-weight: 400;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #666666;
        margin-bottom: 4px;
        font-family: 'Courier New', monospace;
      }

      input[type="text"] {
        width: 100%;
        padding: 8px;
        font-size: 14px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        border: 1px solid #333333;
        background: #191919;
        color: #e0e0e0;
        outline: none;
        box-sizing: border-box;

        &:focus {
          outline: 2px solid #a0a0a0;
          outline-offset: 2px;
        }

        &::placeholder {
          color: #666666;
        }
      }

      input[type="checkbox"] {
        width: 14px;
        height: 14px;
        accent-color: #e0e0e0;
        vertical-align: middle;
        margin-right: 8px;
        cursor: pointer;
      }

      /* Checkbox label layout */
      label:has(input[type="checkbox"]) {
        display: flex;
        align-items: center;
        padding: 4px 0;
        cursor: pointer;
        color: #a0a0a0;
      }
    }

    .image-modal-row {
      display: flex;
      gap: 0;
    }

    .image-upload-input {
      width: 100%;
      padding: 8px;
      font-size: 12px;
      font-family: 'Courier New', monospace;
      border: 1px solid #333333;
      background: #191919;
      color: #a0a0a0;
      cursor: pointer;
      box-sizing: border-box;
    }

    .image-upload-input::file-selector-button {
      padding: 4px 12px;
      border: 1px solid #333333;
      background: #2a2a2a;
      color: #a0a0a0;
      font-size: 11px;
      font-family: 'Courier New', monospace;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      cursor: pointer;
      margin-right: 8px;
    }

    .image-upload-input::file-selector-button:hover {
      background: #e0e0e0;
      color: #191919;
    }

    .image-modal-actions {
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #333333;
      gap: 8px;
    }

    .image-modal-actions-right {
      display: flex;
      gap: 8px;
    }

    .image-modal-actions button {
      padding: 8px 16px;
      font-size: 11px;
      font-weight: 400;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-family: 'Courier New', monospace;
      border: 1px solid #333333;
      cursor: pointer;
      transition: none;
    }

    .image-modal-save {
      background: #e0e0e0;
      color: #191919;
      border-color: #e0e0e0 !important;

      &:hover {
        background: #ffffff;
      }
    }

    .image-modal-cancel {
      background: #1a1a1a;
      color: #a0a0a0;

      &:hover {
        background: #e0e0e0;
        color: #191919;
      }
    }

    .image-modal-delete {
      background: transparent;
      color: #ff4444;
      border-color: #ff4444 !important;

      &:hover {
        background: #ff4444;
        color: #191919;
      }
    }

    /* -- Color picker overrides -- */
    .ql-snow .ql-color-picker .ql-picker-label svg {
      width: 18px;
      height: 18px;
    }

    .ql-snow .ql-color-picker .ql-picker-label .ql-color-label {
      opacity: 1;
    }

    .ql-snow .ql-color-picker .ql-picker-label .ql-stroke {
      stroke: #a0a0a0;
    }

    /* Hide Quill's built-in color picker dropdowns -- we use our modal */
    .ql-snow .ql-color-picker .ql-picker-options {
      display: none !important;
    }

    /* Active format states */
    .ql-toolbar button.ql-active {
      background: #e0e0e0 !important;
    }

    .ql-toolbar button.ql-active .ql-stroke {
      stroke: #191919 !important;
    }

    .ql-toolbar button.ql-active .ql-fill {
      fill: #191919 !important;
    }

    /* Color modal */
    .color-modal {
      background: #1a1a1a;
      border: 1px solid #333333;
      width: 320px;
      max-width: 90%;
    }

    .color-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
      padding: 12px 16px;
    }

    .color-swatch {
      width: 24px;
      height: 24px;
      border: 1px solid #444444;
      cursor: pointer;
      padding: 0;
      transition: none;
    }

    .color-swatch:hover {
      border-color: #ffffff;
      transform: scale(1.15);
      z-index: 1;
      position: relative;
    }

    .color-swatch-active {
      border: 2px solid #ffffff !important;
    }

    .color-swatch-none {
      background: #191919 !important;
      position: relative;
    }

    .color-swatch-none::after {
      content: '';
      position: absolute;
      top: 3px;
      left: 3px;
      right: 3px;
      bottom: 3px;
      background: linear-gradient(135deg, transparent 40%, #ff4444 40%, #ff4444 60%, transparent 60%);
    }

    .color-custom-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-top: 1px solid #333333;
    }

    .color-custom-label {
      font-size: 11px;
      font-family: 'Courier New', monospace;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #666666;
      flex-shrink: 0;
    }

    .color-custom-input {
      flex: 1;
      height: 28px;
      border: 1px solid #333333;
      background: #191919;
      cursor: pointer;
      padding: 0;
    }

    .color-custom-input::-webkit-color-swatch-wrapper {
      padding: 2px;
    }

    .color-custom-input::-webkit-color-swatch {
      border: none;
    }

    /* Kill Quill's built-in tooltip completely -- we use custom modals */
    .ql-snow .ql-tooltip {
      display: none !important;
      position: absolute !important;
      left: -9999px !important;
      visibility: hidden !important;
    }
  `;

  return (
    <div ref={containerRef} css={containerStyles}>
      <div className="control-bar">
        <button
          className={`control-button ${isFullscreen ? 'active' : ''}`}
          onClick={toggleFullscreen}
          title="Toggle Fullscreen"
        >
          {isFullscreen ? 'Exit' : 'Expand'}
        </button>
        <button
          className={`control-button ${isCodeView ? 'active' : ''}`}
          onClick={toggleCodeView}
          title="Toggle Code View"
        >
          {isCodeView ? 'Visual' : 'Source'}
        </button>
      </div>

      <div className="editor-wrapper">
        <div ref={editorRef}></div>
      </div>

      <div className="code-editor" ref={codeEditorRef}></div>

      {tableGrid && (
        <div>
          <div className="table-grid-overlay" onClick={() => { setTableGrid(null); setTableHover({ row: 0, col: 0 }); }} />
          <div className="table-grid-picker" style={{ top: tableGrid.top, left: tableGrid.left }}>
            <div className="table-grid-picker-label">
              {tableHover.row > 0 ? `${tableHover.row} x ${tableHover.col}` : 'Select size'}
            </div>
            <div className="table-grid-rows">
              {[1,2,3,4,5,6,7,8].map(row => (
                <div className="table-grid-row" key={row}>
                  {[1,2,3,4,5,6,7,8].map(col => (
                    <button
                      key={col}
                      className={`table-grid-cell ${row <= tableHover.row && col <= tableHover.col ? 'active' : ''}`}
                      onMouseEnter={() => setTableHover({ row, col })}
                      onClick={() => insertTable(row, col)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTable && (
        <div className="table-toolbar" style={{ top: activeTable.top, right: activeTable.right }}>
          <button className="table-toolbar-btn" onClick={() => tableAction('insertRowAbove')}>+ Row Above</button>
          <button className="table-toolbar-btn" onClick={() => tableAction('insertRowBelow')}>+ Row Below</button>
          <button className="table-toolbar-btn" onClick={() => tableAction('insertColLeft')}>+ Col Left</button>
          <button className="table-toolbar-btn" onClick={() => tableAction('insertColRight')}>+ Col Right</button>
          <button className="table-toolbar-btn" onClick={() => tableAction('deleteRow')}>- Row</button>
          <button className="table-toolbar-btn" onClick={() => tableAction('deleteCol')}>- Col</button>
          <button className="table-toolbar-btn delete-btn" onClick={deleteActiveTable}>Delete Table</button>
        </div>
      )}

      {linkModal && (
        <div className="image-modal-overlay" onClick={() => setLinkModal(null)}>
          <div className="image-modal" onClick={(e) => e.stopPropagation()}>
            <div className="image-modal-header">Link Properties</div>
            <div className="image-modal-field">
              <label>URL</label>
              <input
                type="text"
                value={linkModal.url}
                onChange={(e) => setLinkModal({ ...linkModal, url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="image-modal-field">
              <label>Text</label>
              <input
                type="text"
                value={linkModal.text}
                onChange={(e) => setLinkModal({ ...linkModal, text: e.target.value })}
                placeholder="Link text"
              />
            </div>
            <div className="image-modal-field">
              <label>
                <input
                  type="checkbox"
                  checked={linkModal.target === '_blank'}
                  onChange={(e) => setLinkModal({ ...linkModal, target: e.target.checked ? '_blank' : '' })}
                  style={{ marginRight: '8px' }}
                />
                Open in new tab
              </label>
            </div>
            <div className="image-modal-actions">
              <button className="image-modal-delete" onClick={removeLink}>Unlink</button>
              <div className="image-modal-actions-right">
                <button className="image-modal-cancel" onClick={() => setLinkModal(null)}>Cancel</button>
                <button className="image-modal-save" onClick={saveLinkProps}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {colorModal && (
        <div className="image-modal-overlay" onClick={() => setColorModal(null)}>
          <div className="color-modal" onClick={(e) => e.stopPropagation()}>
            <div className="image-modal-header">
              {colorModal.type === 'color' ? 'Text Color' : 'Highlight Color'}
            </div>
            <div className="color-grid">
              <button
                className="color-swatch color-swatch-none"
                title="Remove color"
                onClick={() => applyColor(null)}
              />
              {colorSwatches.map(c => (
                <button
                  key={c}
                  className={`color-swatch ${colorModal.current === c ? 'color-swatch-active' : ''}`}
                  style={{ backgroundColor: c }}
                  title={c}
                  onClick={() => applyColor(c)}
                />
              ))}
            </div>
            <div className="color-custom-row">
              <label className="color-custom-label">Custom</label>
              <input
                type="color"
                className="color-custom-input"
                value={colorModal.current || '#ffffff'}
                onChange={(e) => {
                  setColorModal({ ...colorModal, current: e.target.value });
                  applyColor(e.target.value, true);
                }}
              />
              <button className="image-modal-save" onClick={() => setColorModal(null)}>Apply</button>
            </div>
            <div className="image-modal-actions">
              <button className="image-modal-delete" onClick={() => applyColor(null)}>Remove</button>
              <button className="image-modal-cancel" onClick={() => setColorModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {videoModal && (
        <div className="image-modal-overlay" onClick={() => setVideoModal(null)}>
          <div className="image-modal" onClick={(e) => e.stopPropagation()}>
            <div className="image-modal-header">Embed Video</div>
            <div className="image-modal-field">
              <label>Video URL</label>
              <input
                type="text"
                value={videoModal.url}
                onChange={(e) => setVideoModal({ ...videoModal, url: e.target.value })}
                placeholder="https://www.youtube.com/embed/... or video URL"
              />
            </div>
            <div className="image-modal-actions">
              <div />
              <div className="image-modal-actions-right">
                <button className="image-modal-cancel" onClick={() => setVideoModal(null)}>Cancel</button>
                <button className="image-modal-save" onClick={insertVideo}>Insert</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {imageModal && (
        <div className="image-modal-overlay" onClick={() => setImageModal(null)}>
          <div className="image-modal" onClick={(e) => e.stopPropagation()}>
            <div className="image-modal-header">{imageModal.isNew ? 'Insert Image' : 'Image Properties'}</div>
            {imageModal.src && (
              <div className="image-modal-preview">
                <img src={imageModal.src} alt="Preview" />
              </div>
            )}
            <div className="image-modal-field">
              <label>Image URL</label>
              <input
                type="text"
                value={imageModal.src}
                onChange={(e) => setImageModal({ ...imageModal, src: e.target.value })}
                placeholder="https://..."
              />
            </div>
            {imageModal.isNew && (
              <div className="image-modal-field">
                <label>Or Upload File</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="image-upload-input"
                />
              </div>
            )}
            <div className="image-modal-field">
              <label>Alt Text</label>
              <input
                type="text"
                value={imageModal.alt}
                onChange={(e) => setImageModal({ ...imageModal, alt: e.target.value })}
                placeholder="Describe this image..."
              />
            </div>
            <div className="image-modal-row">
              <div className="image-modal-field">
                <label>Width</label>
                <input
                  type="text"
                  value={imageModal.width}
                  onChange={(e) => setImageModal({ ...imageModal, width: e.target.value })}
                  placeholder="e.g. 600 or 100%"
                />
              </div>
              <div className="image-modal-field">
                <label>Height</label>
                <input
                  type="text"
                  value={imageModal.height}
                  onChange={(e) => setImageModal({ ...imageModal, height: e.target.value })}
                  placeholder="e.g. 400 or auto"
                />
              </div>
            </div>
            <div className="image-modal-actions">
              {!imageModal.isNew && <button className="image-modal-delete" onClick={deleteImage}>Delete</button>}
              {imageModal.isNew && <div />}
              <div className="image-modal-actions-right">
                <button className="image-modal-cancel" onClick={() => setImageModal(null)}>Cancel</button>
                <button className="image-modal-save" onClick={saveImageProps}>{imageModal.isNew ? 'Insert' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

Builder.registerEditor({
  name: 'RichText',
  component: RichTextEditor
});
