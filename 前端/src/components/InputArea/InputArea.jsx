import React, { useState } from 'react';
import styles from './InputArea.module.css';

export default function InputArea({ options, onExecute, disabled }) {
    const [selectedOptions, setSelectedOptions] = useState([]);
    const [inputText, setInputText] = useState("");

    // 切换选项选择状态
    const toggleOption = (opt) => {
        if (disabled) return;
        setSelectedOptions(prev => {
            if (prev.includes(opt.id)) {
                // 取消选择
                return prev.filter(id => id !== opt.id);
            } else {
                // 添加选择
                return [...prev, opt.id];
            }
        });
    };

    // 执行提交
    const handleSubmit = (e) => {
        e.preventDefault();

        if (disabled) return;

        // 验证是否有选择或输入
        if (selectedOptions.length === 0 && !inputText.trim()) {
            // 显示提示信息
            alert("请选择至少一个选项或输入自定义内容");
            return;
        }

        // 提交所有决策信息
        onExecute(selectedOptions, inputText, "player_human", "ceo");

        // 重置状态
        setSelectedOptions([]);
        setInputText("");
    };

    return (
        <div className={styles.container}>
            <div className={styles.optionsGrid}>
                {options.map((opt) => (
                    <button
                        key={opt.id}
                        className={`${styles.optionBtn} ${selectedOptions.includes(opt.id) ? styles.selected : ''}`}
                        onClick={() => toggleOption(opt)}
                        disabled={disabled}
                        style={{ opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
                    >
                        <div className={styles.optHeader}>
                            <span className={styles.optLabel}>{opt.label}</span>
                            {opt.cost > 0 && (
                                <span style={{ fontSize: '0.8rem', color: '#ff4444', marginLeft: 'auto', marginRight: '10px' }}>
                                    -${opt.cost}
                                </span>
                            )}
                            {selectedOptions.includes(opt.id) && (
                                <span className={styles.optCheckmark}>✓</span>
                            )}
                        </div>
                        <span className={styles.optDesc}>
                            {opt.description}
                            {opt.cost_desc && <span style={{ display: 'block', marginTop: '5px', color: '#999', fontSize: '0.8rem' }}>💰 {opt.cost_desc}</span>}
                        </span>
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit} className={styles.inputForm}>
                <span className={styles.prompt}>{'>'}</span>
                <input
                    type="text"
                    className={styles.input}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={disabled ? "AI 正在思考中..." : "输入您的指令..."}
                    disabled={disabled}
                />
                <button
                    type="submit"
                    className={styles.sendBtn}
                    disabled={disabled}
                    style={{ opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
                >
                    {disabled ? '...' : '执行'}
                </button>
            </form>
        </div>
    );
}
