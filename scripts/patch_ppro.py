import re

with open('host/premiere.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update getClipPathOrName
old_get_clip = '''function getClipPathOrName(clip) {
    if (!clip) return "";
    var p = "";
    try {
        if (clip.projectItem) {
            if (typeof clip.projectItem.getMediaPath === "function") {
                p = clip.projectItem.getMediaPath();
            }
            if (!p && clip.projectItem.treePath) {
                p = clip.projectItem.treePath;
            }
        }
    } catch (e1) {}
    if (p && p.length > 3) return p;
    try {
        if (clip.name) return clip.name;
    } catch (e2) {}
    return "";
}'''

new_get_clip = '''function getClipPathOrName(clip) {
    if (!clip) return "";
    var p = "";
    try {
        if (clip.projectItem) {
            if (typeof clip.projectItem.getMediaPath === "function") {
                p = clip.projectItem.getMediaPath();
            }
            if (!p && clip.projectItem.treePath) {
                p = clip.projectItem.treePath;
            }
        }
    } catch (e1) {}

    // Agar loyiha papkasida shu nomli fayl bo'lsa, to'liq yo'lini aniqlash
    if (!p || p.length <= 3) {
        try {
            var cName = clip.name || (clip.projectItem ? clip.projectItem.name : "");
            if (cName && app.project && app.project.path) {
                var projFolder = new File(app.project.path).parent.fsName.replace(/\\\\/g, "/");
                var candidate = projFolder + "/" + cName;
                if (new File(candidate).exists) {
                    p = candidate;
                }
            }
        } catch (projErr) {}
    }

    if (p && p.length > 3) {
        return String(p).replace(/\\\\/g, "/");
    }
    try {
        if (clip.name) return String(clip.name);
    } catch (e2) {}
    return "";
}'''

assert old_get_clip in content, 'old_get_clip not found'
content = content.replace(old_get_clip, new_get_clip)

# 2. Update ppro_getSequenceInfo
old_seq_info = '''function ppro_getSequenceInfo() {
    try {
        var seq = ppro_getSeq();
        if (!seq) {
            return JSON.stringify({
                ok: false,
                exists: false,
                message: "Aktiv ketma-ketlik (sequence) topilmadi! Iltimos, Premiere Pro'da videoni oching."
            });
        }
        var curTicks = seq.getPlayerPosition();
        var curSec = parseFloat(curTicks.seconds) || (parseFloat(curTicks.ticks) / 254016000000) || 0;
        var endTicks = seq.end;
        var durationSec = parseFloat(endTicks) / 254016000000;

        return JSON.stringify({
            ok: true,
            exists: true,
            name: seq.name,
            frameRate: seq.framerate,
            time: curSec,
            duration: durationSec > 0 ? durationSec : 0
        });
    } catch (e) {
        return JSON.stringify({ ok: false, exists: false, error: e.toString(), line: e.line || 0 });
    }
}'''

new_seq_info = '''function ppro_getSequenceInfo() {
    try {
        var seq = ppro_getSeq();
        if (!seq) {
            return JSON.stringify({
                ok: false,
                exists: false,
                message: "Aktiv ketma-ketlik (sequence) topilmadi! Iltimos, Premiere Pro'da videoni oching."
            });
        }
        var curSec = 0;
        try {
            var curTicks = seq.getPlayerPosition();
            if (curTicks) {
                curSec = parseFloat(curTicks.seconds) || (parseFloat(curTicks.ticks) / 254016000000) || 0;
            }
        } catch (posErr) {}

        var fps = 25;
        try {
            if (seq.framerate) {
                fps = parseFloat(seq.framerate) || 25;
            }
        } catch (fpsErr) {}

        var durationSec = 0;
        try {
            if (seq.end) {
                durationSec = parseFloat(seq.end) / 254016000000 || 0;
            }
        } catch (durErr) {}

        return JSON.stringify({
            ok: true,
            exists: true,
            name: String(seq.name || "Aktiv Sequence"),
            frameRate: fps,
            time: curSec,
            duration: durationSec > 0 ? durationSec : 0
        });
    } catch (e) {
        return JSON.stringify({ ok: false, exists: false, error: e.toString(), line: e.line || 0 });
    }
}'''

assert old_seq_info in content, 'old_seq_info not found'
content = content.replace(old_seq_info, new_seq_info)

# 3. In ppro_getSelectedClipAudioPath, define returnSingleClip helper and use it
old_extract_clip = '''            return {
                ok: true,
                success: true,
                filePath: p,
                name: clip.name || p.split("/").pop().split("\\\\").pop(),
                inPoint: inSec,
                outPoint: outSec,
                start: startSec,
                end: endSec,
                duration: dur,
                offset: startSec - inSec
            };
        }'''

new_extract_clip = '''            return {
                ok: true,
                success: true,
                filePath: p,
                name: clip.name || p.split("/").pop().split("\\\\").pop(),
                inPoint: inSec,
                outPoint: outSec,
                start: startSec,
                end: endSec,
                duration: dur,
                offset: startSec - inSec
            };
        }

        function returnSingleClip(info) {
            if (!info) return null;
            return JSON.stringify({
                ok: true,
                success: true,
                multiple: false,
                clips: [info],
                count: 1,
                filePath: info.filePath,
                name: info.name,
                inPoint: info.inPoint,
                outPoint: info.outPoint,
                start: info.start,
                end: info.end,
                duration: info.duration,
                offset: info.offset
            });
        }'''

assert old_extract_clip in content, 'old_extract_clip not found'
content = content.replace(old_extract_clip, new_extract_clip)

# Replace returns in branch C and D
content = content.replace('if (cVInfo) return JSON.stringify(cVInfo);', 'if (cVInfo) return returnSingleClip(cVInfo);')
content = content.replace('if (cAInfo) return JSON.stringify(cAInfo);', 'if (cAInfo) return returnSingleClip(cAInfo);')
content = content.replace('if (infoV2) return JSON.stringify(infoV2);', 'if (infoV2) return returnSingleClip(infoV2);')
content = content.replace('if (infoA2) return JSON.stringify(infoA2);', 'if (infoA2) return returnSingleClip(infoA2);')

for target_file in ['host/premiere.jsx', 'host/aftereffects.jsx', 'host/shared.jsx']:
    with open(target_file, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Successfully patched {target_file}')
