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
  const [isFocused, setIsFocused] = useState(false);

  // 同步滚动
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    const highlighter = target.parentElement?.querySelector('.syntax-highlighter') as HTMLElement;
    if (highlighter) {
      highlighter.scrollTop = target.scrollTop;
      highlighter.scrollLeft = target.scrollLeft;
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

  return (
    <div className="code-editor">
      <div className="code-editor-container">
        {/* 语法高亮背景层 */}
        <div className="syntax-highlighter-wrapper">
          <SyntaxHighlighter
            language={language}
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              padding: '16px',
              background: 'transparent',
              fontSize: '13px',
              lineHeight: '1.6',
              fontFamily: "'Fira Code', 'Monaco', 'Menlo', 'Consolas', monospace",
            }}
            codeTagProps={{
              style: { fontFamily: "'Fira Code', 'Monaco', 'Menlo', 'Consolas', monospace" }
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