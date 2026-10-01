/**
 * O'zbekcha AI Subtitr - O'zbek Tili va Vaqt Yordamchilari (uzbekUtils.js)
 */

const UzbekUtils = {
    /**
     * Soniyalarni 00:00:00.000 formatiga o'tkazish
     */
    formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) seconds = 0;
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);

        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
    },

    /**
     * 00:00:00.000 yoki 00:00,000 formatidagi vaqtni soniyalarga o'tkazish
     */
    parseTime(timeStr) {
        if (!timeStr) return 0;
        const normalized = timeStr.trim().replace(',', '.');
        const parts = normalized.split(':');

        let seconds = 0;
        if (parts.length === 3) {
            seconds = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
        } else if (parts.length === 2) {
            seconds = parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
        } else {
            seconds = parseFloat(parts[0]) || 0;
        }
        return isNaN(seconds) ? 0 : Math.max(0, seconds);
    },

    /**
     * O'zbekcha tutuq va harf belgilarini standartlashtirish
     */
    normalizeUzbek(text) {
        if (!text) return "";
        let res = text;
        // o‘ va g‘ harflarini to'g'ri ko'rinishga keltirish
        res = res.replace(/([oO])['`‘’ʻʼ´]/g, (m, p1) => p1 === 'O' ? 'O‘' : 'o‘');
        res = res.replace(/([gG])['`‘’ʻʼ´]/g, (m, p1) => p1 === 'G' ? 'G‘' : 'g‘');
        return res;
    },

    /**
     * Brauzer / Panel orqali matnli faylni yuklab olish yoki diskka saqlash
     */
    downloadFile(filename, content, mimeType = "text/plain;charset=utf-8") {
        let savedPath = null;
        if (typeof require !== "undefined") {
            try {
                const fs = require('fs');
                const os = require('os');
                const path = require('path');
                const targetDir = path.join(os.homedir(), "Downloads");
                savedPath = path.join(targetDir, filename);
                fs.writeFileSync(savedPath, content, 'utf-8');
            } catch (e) {
                console.warn("[UzbekUtils] Diskka yozishda:", e);
            }
        }

        try {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {}

        return savedPath;
    },

    /**
     * HTML belgilarni xavfsiz qilish
     */
    escapeHtml(text) {
        if (!text) return "";
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
};

window.UzbekUtils = UzbekUtils;
