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

function RichTextEditor(props) {
  const editorRef = useRef(null);
  const quillRef = useRef(null);
  const containerRef = useRef(null);
  const codeEditorRef = useRef(null);
  const codeMirrorRef = useRef(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCodeView, setIsCodeView] = useState(false);

  useEffect(() => {
    if (!editorRef.current || quillRef.current) return;

    // Comprehensive toolbar configuration
    const toolbarOptions = [
      // Text formatting
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      
      // Text styles
      ['bold', 'italic', 'underline', 'strike'],
      
      // Text color and background
      [{ 'color': [] }, { 'background': [] }],
      
      // Superscript/subscript
      [{ 'script': 'sub'}, { 'script': 'super' }],
      
      // Lists and indentation
      [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'list': 'check' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      
      // Text alignment and direction
      [{ 'align': [] }],
      [{ 'direction': 'rtl' }],
      
      // Block elements
      ['blockquote', 'code-block'],
      
      // Media
      ['link', 'image', 'video'],
      
      // Clean formatting
      ['clean']
    ];

    // Initialize Quill with all modules
    const quill = new Quill(editorRef.current, {
      theme: 'snow',
      modules: {
        toolbar: toolbarOptions,
        'better-table': {
          operationMenu: {
            items: {
              unmergeCells: {
                text: 'Unmerge cells'
              },
              insertColumnRight: {
                text: 'Insert column right'
              },
              insertColumnLeft: {
                text: 'Insert column left'
              },
              insertRowUp: {
                text: 'Insert row up'
              },
              insertRowDown: {
                text: 'Insert row down'
              },
              mergeCells: {
                text: 'Merge selected cells'
              },
              deleteColumn: {
                text: 'Delete column'
              },
              deleteRow: {
                text: 'Delete row'
              },
              deleteTable: {
                text: 'Delete table'
              }
            }
          }
        },
        keyboard: {
          bindings: QuillBetterTable.keyboardBindings
        }
      }
    });

    // Add table button to toolbar
    const toolbar = quill.getModule('toolbar');
    toolbar.addHandler('table', function() {
      const tableModule = quill.getModule('better-table');
      tableModule.insertTable(3, 3);
    });

    // Set initial content
    if (props.value) {
      quill.root.innerHTML = props.value;
    }

    // Handle content changes
    quill.on('text-change', () => {
      const html = quill.root.innerHTML;
      if (props.onChange) {
        props.onChange(html);
      }
    });

    quillRef.current = quill;

    // Add custom table button to toolbar
    const tableButton = document.createElement('button');
    tableButton.innerHTML = '⊞';
    tableButton.className = 'ql-table';
    tableButton.title = 'Insert Table';
    tableButton.onclick = () => {
      const tableModule = quill.getModule('better-table');
      tableModule.insertTable(3, 3);
    };
    
    const toolbarElement = containerRef.current.querySelector('.ql-toolbar');
    if (toolbarElement) {
      toolbarElement.appendChild(tableButton);
    }

    return () => {
      if (quillRef.current) {
        quillRef.current = null;
      }
    };
  }, []);

  // Update content when props change
  useEffect(() => {
    if (quillRef.current && props.value !== undefined) {
      const currentContent = quillRef.current.root.innerHTML;
      if (currentContent !== props.value && !isCodeView) {
        quillRef.current.root.innerHTML = props.value;
      }
    }
  }, [props.value]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const toggleCodeView = () => {
    if (isCodeView) {
      // Switch back to visual editor
      if (quillRef.current && codeMirrorRef.current) {
        try {
          const newHtml = codeMirrorRef.current.state.doc.toString();
          quillRef.current.root.innerHTML = newHtml;
          if (props.onChange) {
            props.onChange(newHtml);
          }
        } catch (error) {
          console.error('Error updating editor:', error);
        }
      }
      setIsCodeView(false);
    } else {
      // Switch to code view
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
          
          // Initialize or update CodeMirror
          if (!codeMirrorRef.current) {
            const extensions = [
              basicSetup,
              htmlLang(),
              keymap.of([indentWithTab]),
              EditorView.lineWrapping
            ];
            
            // Add dark theme if enabled
            if (isDarkMode) {
              extensions.push(oneDark);
            }
            
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

  // Cleanup CodeMirror on unmount
  useEffect(() => {
    return () => {
      if (codeMirrorRef.current) {
        codeMirrorRef.current.destroy();
        codeMirrorRef.current = null;
      }
    };
  }, []);

  const containerStyles = css`
    position: ${isFullscreen ? 'fixed' : 'relative'};
    top: ${isFullscreen ? '0' : 'auto'};
    left: ${isFullscreen ? '0' : 'auto'};
    width: ${isFullscreen ? '100vw' : '100%'};
    height: ${isFullscreen ? '100svh' : 'auto'};
    z-index: ${isFullscreen ? '99999' : 'auto'};
    background: ${isDarkMode ? '#191919' : '#ffffff'};
    display: flex;
    flex-direction: column;
    ${isFullscreen ? 'padding: 0; margin: 0;' : ''}
    
    .control-bar {
      display: flex;
      gap: 8px;
      padding: 8px;
      background: ${isDarkMode ? '#252525' : '#f5f5f5'};
      border-bottom: 1px solid ${isDarkMode ? '#333333' : '#e0e0e0'};
    }
    
    .control-button {
      padding: 6px 12px;
      border: 1px solid ${isDarkMode ? '#404040' : '#d0d0d0'};
      background: ${isDarkMode ? '#2d2d2d' : '#ffffff'};
      color: ${isDarkMode ? '#ffffff' : '#1a1a1a'};
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.2s;
      
      &:hover {
        background: ${isDarkMode ? '#3a3a3a' : '#f0f0f0'};
      }
      
      &.active {
        background: ${isDarkMode ? '#0066cc' : '#0078d4'};
        color: white;
        border-color: ${isDarkMode ? '#0066cc' : '#0078d4'};
      }
    }
    
    .editor-wrapper {
      display: ${isCodeView ? 'none' : 'flex'};
      flex-direction: column;
      ${isFullscreen ? 'flex: 1; overflow: auto; padding: 20px; box-sizing: border-box;' : ''}
      
      > div {
        ${isFullscreen ? 'max-width: 800px; width: 100%; margin: 0 auto;' : 'width: 100%;'}
      }
    }
    
    .code-editor {
      ${isFullscreen ? 'flex: 1; padding: 20px;' : 'height: 400px;'}
      display: ${isCodeView ? 'block' : 'none'};
      margin: 0;
      width: 100%;
      box-sizing: border-box;
      overflow: auto;
      background: ${isDarkMode ? '#191919' : '#ffffff'};
      
      ${isFullscreen ? '> * { max-width: 800px; margin: 0 auto; }' : ''}
      
      .cm-editor {
        height: ${isFullscreen ? 'calc(100svh - 85px)' : '400px'};
        font-size: 14px;
        
        .cm-scroller {
          overflow: auto;
          height: 100%;
        }
        
        .cm-gutters {
          background: ${isDarkMode ? '#252525' : '#f5f5f5'};
          border-right: 1px solid ${isDarkMode ? '#333333' : '#e0e0e0'};
        }
      }
    }
    
    .ql-container {
      ${isFullscreen ? 'height: calc(100svh - 150px);' : 'height: 400px;'}
      overflow-y: auto;
      font-size: 14px;
    }
    
    .ql-editor {
      min-height: 100%;
      background: ${isDarkMode ? '#191919' : '#ffffff'};
      color: ${isDarkMode ? '#ffffff' : '#191919'};
    }
    
    .ql-toolbar {
      background: ${isDarkMode ? '#252525' : '#ffffff'};
      border-color: ${isDarkMode ? '#333333' : '#e0e0e0'};
    }
    
    .ql-toolbar .ql-stroke {
      stroke: ${isDarkMode ? '#ffffff' : '#191919'};
    }
    
    .ql-toolbar .ql-fill {
      fill: ${isDarkMode ? '#ffffff' : '#191919'};
    }
    
    .ql-toolbar .ql-picker-label {
      color: ${isDarkMode ? '#ffffff' : '#191919'};
    }
    
    .ql-toolbar button:hover,
    .ql-toolbar button:focus,
    .ql-toolbar button.ql-active,
    .ql-toolbar .ql-picker-label:hover,
    .ql-toolbar .ql-picker-label.ql-active {
      background: ${isDarkMode ? '#2d2d2d' : '#f0f0f0'};
    }
    
    .ql-container.ql-snow {
      border-color: ${isDarkMode ? '#333333' : '#e0e0e0'};
    }
    
    .ql-picker-options {
      background: ${isDarkMode ? '#252525' : '#ffffff'};
      border-color: ${isDarkMode ? '#333333' : '#e0e0e0'};
    }
    
    .ql-picker-item {
      color: ${isDarkMode ? '#ffffff' : '#191919'};
    }
    
    .ql-picker-item:hover {
      background: ${isDarkMode ? '#2d2d2d' : '#f0f0f0'};
    }

    /* Table styles */
    .quill-better-table-wrapper {
      overflow-x: auto;
    }
    
    .ql-table {
      font-size: 20px;
      padding: 3px 5px;
    }

    /* Code block syntax highlighting */
    .ql-editor pre.ql-syntax {
      background-color: ${isDarkMode ? '#282c34' : '#f5f5f5'};
      color: ${isDarkMode ? '#abb2bf' : '#383a42'};
      overflow: visible;
      border-radius: 4px;
      padding: 16px;
      margin: 8px 0;
    }

    /* Code inline */
    .ql-editor code {
      background-color: ${isDarkMode ? '#2d2d2d' : '#f4f4f4'};
      color: ${isDarkMode ? '#e06c75' : '#e45649'};
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }

    /* Blockquote */
    .ql-editor blockquote {
      border-left: 4px solid ${isDarkMode ? '#61afef' : '#007acc'};
      background: ${isDarkMode ? '#2d2d2d' : '#f9f9f9'};
      padding: 10px 20px;
      margin: 8px 0;
    }

    /* Links */
    .ql-editor a {
      color: ${isDarkMode ? '#61afef' : '#0066cc'};
      text-decoration: underline;
    }

    /* Images and videos */
    .ql-editor img,
    .ql-editor video {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      margin: 8px 0;
    }
  `;

  return (
    <div ref={containerRef} css={containerStyles}>
      <div className="control-bar">
        <button 
          className={`control-button ${isDarkMode ? 'active' : ''}`}
          onClick={toggleDarkMode}
          title="Toggle Dark Mode"
        >
          {isDarkMode ? '☀️ Light' : '🌙 Dark'}
        </button>
        <button 
          className={`control-button ${isFullscreen ? 'active' : ''}`}
          onClick={toggleFullscreen}
          title="Toggle Fullscreen"
        >
          {isFullscreen ? '⊡ Exit Fullscreen' : '⛶ Fullscreen'}
        </button>
        <button 
          className={`control-button ${isCodeView ? 'active' : ''}`}
          onClick={toggleCodeView}
          title="Toggle Code View"
        >
          {isCodeView ? '👁️ Visual' : '</> Code'}
        </button>
      </div>
      
      <div className="editor-wrapper">
        <div ref={editorRef}></div>
      </div>
      
      <div className="code-editor" ref={codeEditorRef}></div>
    </div>
  );
}

// Register the editor with Builder
Builder.registerEditor({
  name: 'RichText',
  component: RichTextEditor
});
