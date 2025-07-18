// ==UserScript==
// @name         自動翻譯輸入框內容至簡體中文
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  在輸入框輸入內容後，延遲3秒自動將其翻譯成簡體中文，並確保送出訊息時使用簡體。
// @description:en Automatically translates input to Simplified Chinese after a 3-second delay and ensures simplified text is sent.
// @author       github.com/tasi788
// @match        https://live.bilibili.com/*
// @require      https://unpkg.com/opencc-js@1.0.5/dist/umd/t2cn.js
// @grant        none
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // --- 請在此處配置 ---
    const inputSelector = 'textarea.chat-input'; // 例如: 'input#danmakuInput', 'textarea.chat-box', '.bilibili-player-video-danmaku-input'
    // --- 配置結束 ---

    if (!inputSelector || inputSelector === 'YOUR_INPUT_SELECTOR_HERE') {
        console.warn('自動翻譯腳本：未配置輸入框選擇器 (inputSelector)。請編輯腳本並填寫正確的選擇器。');
        alert('自動翻譯腳本警告：\n\n未配置輸入框選擇器 (inputSelector)。\n請編輯腳本源碼，將 `YOUR_INPUT_SELECTOR_HERE` 替換為正確的 CSS 選擇器。');
        return;
    }

    if (document.location.href.indexOf('live.bilibili.com') !== -1 && 'live.bilibili.com' !== 'http*://*/*' && 'live.bilibili.com' !== 'https://*/*' && 'live.bilibili.com' !== '*') {
         // Basic check if the placeholder URL is still there and it's not a generic one.
    } else if ('live.bilibili.com' === 'live.bilibili.com' || 'live.bilibili.com'.includes('*')) {
        // If it's still the placeholder or a wildcard, we assume it's not configured yet for a specific site.
        // No specific warning here as @match handles the execution scope, but good to be mindful.
    }


    let targetElement;
    let debounceTimer;
    let openCCConverter;

    // 等待 OpenCC 加載完成
    if (typeof OpenCC === 'undefined') {
        console.error('自動翻譯腳本：OpenCC 庫未能成功加載。請檢查 @require 連結是否有效。');
        alert('自動翻譯腳本錯誤：\n\nOpenCC.js 庫未能成功加載。\n請檢查 userscript 中的 @require 連結是否有效，並確保網路連線正常。');
        return;
    }

    try {
        openCCConverter = OpenCC.Converter({ from: 'tw', to: 'cn' }); // 從繁體中文（台灣）轉換到簡體中文
                                                                    // 您可以根據需要更改 from 的值，例如 't' (通用繁體), 'hk' (香港繁體)
    } catch (e) {
        console.error('自動翻譯腳本：初始化 OpenCC Converter 失敗。', e);
        alert('自動翻譯腳本錯誤：\n\n初始化 OpenCC Converter 失敗。\n可能是 @require 的 OpenCC 版本不兼容或損壞。');
        return;
    }


    function initialize() {
        targetElement = document.querySelector(inputSelector);

        if (!targetElement) {
            console.log('自動翻譯腳本：找不到指定的輸入框，選擇器為:', inputSelector, '將在5秒後重試。');
            // 有些動態加載的頁面可能需要延遲查找
            setTimeout(initialize, 5000);
            return;
        }

        console.log('自動翻譯腳本：已找到輸入框，監聽中...', targetElement);
        
        // 找到送出按鈕
        const sendButton = document.querySelector('button.bl-button.live-skin-highlight-button-bg');
        if (sendButton) {
            console.log('自動翻譯腳本：找到送出按鈕，監聽中...', sendButton);
            // 監聽送出按鈕的點擊事件
            sendButton.addEventListener('click', function(event) {
                // 在送出前確保文字已轉換為簡體
                const originalText = targetElement.value;
                if (originalText && originalText.trim() !== '') {
                    try {
                        const simplifiedText = openCCConverter(originalText);
                        if (originalText !== simplifiedText) {
                            targetElement.value = simplifiedText;
                            // 觸發 input 事件，通知網站輸入已更改
                            const inputEvent = new Event('input', { bubbles: true });
                            targetElement.dispatchEvent(inputEvent);
                            console.log('自動翻譯腳本：送出前已將文字轉換為簡體');
                        }
                    } catch (error) {
                        console.error('自動翻譯腳本：送出前轉換文字時發生錯誤:', error);
                    }
                }
            }, true); // 使用捕獲階段，確保在網站處理點擊事件前執行
        } else {
            console.log('自動翻譯腳本：未找到送出按鈕，僅監聽輸入框');
        }

        // 監聽表單提交事件
        if (targetElement.form) {
            targetElement.form.addEventListener('submit', function(event) {
                // 在表單提交前確保文字已轉換為簡體
                const originalText = targetElement.value;
                if (originalText && originalText.trim() !== '') {
                    try {
                        const simplifiedText = openCCConverter(originalText);
                        if (originalText !== simplifiedText) {
                            targetElement.value = simplifiedText;
                            console.log('自動翻譯腳本：表單提交前已將文字轉換為簡體');
                        }
                    } catch (error) {
                        console.error('自動翻譯腳本：表單提交前轉換文字時發生錯誤:', error);
                    }
                }
            }, true); // 使用捕獲階段，確保在網站處理提交事件前執行
        }

        targetElement.addEventListener('input', function(event) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const originalText = targetElement.value;
                // 檢查輸入框是否為空，或者是否包含不應轉換的特殊指令（如果有的話）
                if (originalText.trim() === '') {
                    return;
                }

                try {
                    const simplifiedText = openCCConverter(originalText);

                    // 檢查轉換後的文本是否與原文本相同（例如，原文本已是簡體）
                    // 同時檢查在延遲期間用戶是否修改了文本
                    if (targetElement.value === originalText && originalText !== simplifiedText) {
                        // 記錄當前光標位置
                        let cursorPos = targetElement.selectionStart;
                        const originalLength = originalText.length;
                        const newLength = simplifiedText.length;

                        targetElement.value = simplifiedText;

                        // 嘗試恢復光標位置
                        // 如果文本長度改變，簡單地恢復原光標位置可能不準確，
                        // 但對於大部分同形替代的繁簡轉換，長度變化不大
                        if (newLength === originalLength) {
                            targetElement.setSelectionRange(cursorPos, cursorPos);
                        } else {
                            // 如果長度不同，一個簡單的策略是將光標置於末尾或按比例調整
                            // 此處簡單置於末尾，可根據需要調整
                             targetElement.setSelectionRange(newLength, newLength);
                        }

                        // 觸發 input 和 change 事件，確保網站能夠檢測到輸入變化
                        const inputEvent = new Event('input', { bubbles: true });
                        targetElement.dispatchEvent(inputEvent);
                        
                        const changeEvent = new Event('change', { bubbles: true });
                        targetElement.dispatchEvent(changeEvent);
                    }
                } catch (error) {
                    console.error('自動翻譯腳本：文本轉換時發生錯誤:', error);
                }
            }, 3000); // 延遲 3 秒
        });

        console.log('自動翻譯腳本已成功加載並監聽輸入框。');
        // alert('自動翻譯腳本已成功加載並監聽輸入框。'); // 可選：給用戶一個明確的提示
    }

    // 考慮到頁面元素可能是動態加載的，延遲一點啟動或使用 MutationObserver
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        // DOMContentLoaded 已經觸發，或者頁面已完全加載
        initialize();
    }

})();
