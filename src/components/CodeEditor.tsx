import React, { useRef, useEffect, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './CodeEditor.css';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  language?: string;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  placeholder = "编写代码...",
  language = "javascript"
}) => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const highlighterRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // 同步滚动
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    if (highlighterRef.current) {
      highlighterRef.current.scrollTop = target.scrollTop;
      highlighterRef.current.scrollLeft = target.scrollLeft;
    }
  };

  // 处理Tab键缩进
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);
      
      // 设置光标位置
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  // 统一的样式配置，确保文本区域和语法高亮完全一致
  const editorStyles = {
    fontFamily: "'Fira Code', 'Monaco', 'Menlo', 'Consolas', monospace",
    fontSize: '14px',
    lineHeight: '1.5',
    padding: '16px',
    margin: 0,
    tabSize: 2,
    MozTabSize: 2,
    letterSpacing: '0px',
    wordSpacing: '0px'
  };

  return (
    <div className="code-editor">
      <div className="code-editor-container">
        {/* 语法高亮背景层 */}
        <div 
          ref={highlighterRef}
          className="syntax-highlighter-wrapper"
          style={editorStyles}
        >
          <SyntaxHighlighter
            language={language}
            style={vscDarkPlus}
            customStyle={{
              ...editorStyles,
              background: 'transparent',
              border: 'none',
              overflow: 'visible'
            }}
            codeTagProps={{
              style: {
                ...editorStyles,
                background: 'transparent'
              }
            }}
            className="syntax-highlighter"
          >
            {value || ' '}
          </SyntaxHighlighter>
        </div>
        
        {/* 透明的文本输入层 */}
        <textarea
          ref={textAreaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={`code-textarea ${isFocused ? 'focused' : ''}`}
          style={editorStyles}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
      </div>
    </div>
  );
};

export default CodeEditor; 